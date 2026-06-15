# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import httpx
import json
import re
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

import database as db

logger = logging.getLogger("rtarf-soc")

# ── Scheduler setup ──────────────────────────────────────────────
ICT = pytz.timezone("Asia/Bangkok")
scheduler = AsyncIOScheduler(timezone=ICT)

# ── In-memory store สะสม alert ที่วิเคราะห์แล้วในแต่ละวัน ──────
daily_alerts: list = []

def _collect_alert(alert, analysis: dict):
    daily_alerts.append({
        "alert_name":         alert.name,
        "severity":           alert.severity,
        "verdict":            analysis.get("verdict", "-"),
        "mitre_tactic":       analysis.get("mitre_tactic", "-"),
        "mitre_technique":    analysis.get("mitre_technique", "-"),
        "recommended_action": analysis.get("recommended_action", "-"),
    })

async def daily_report_job():
    logger.info(f"[Scheduler] Starting daily report job ({len(daily_alerts)} alerts)...")
    try:
        from telegram_sender import send_daily_report
        snapshot = list(daily_alerts)
        daily_alerts.clear()
        if not snapshot:
            logger.info("[Scheduler] No alerts today — skipping report")
            return
        await send_daily_report(snapshot)
        logger.info("[Scheduler] Report sent via Telegram")
    except Exception as e:
        logger.error(f"[Scheduler] daily_report_job failed: {e}", exc_info=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    db.migrate_from_json()
    logger.info("[DB] Ready")

    scheduler.add_job(
        daily_report_job,
        CronTrigger(hour=0, minute=0, timezone=ICT),
        id="daily_report",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] Started — daily report at 00:00 ICT")
    yield
    scheduler.shutdown(wait=False)
    logger.info("[Scheduler] Stopped")

app = FastAPI(title="RTARF AI-SOC", version="1.0", lifespan=lifespan)

# ── Pydantic models ───────────────────────────────────────────────
class Alert(BaseModel):
    id: str
    name: str
    severity: str
    issue_domain: str
    detection_method: str
    category: str
    observation_date: str
    description: str
    source_ip: Optional[str] = None
    hostname: Optional[str] = None
    target_user: Optional[str] = None
    process: Optional[str] = None
    status: Optional[str] = "OPEN"

class StatusUpdate(BaseModel):
    status: str  # OPEN | ACKNOWLEDGED | CLOSED

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:14b"


# ── Helpers ───────────────────────────────────────────────────────
def _has_chinese(text: str) -> bool:
    return bool(re.search(r'[一-鿿]', str(text)))


def _to_str(val, sep: str = ", ") -> str:
    if isinstance(val, list):
        filtered = [str(v) for v in val if v]
        return sep.join(filtered) if filtered else "-"
    if val in (None, "null", "[]", "", "None", "none"):
        return "-"
    s = str(val).strip()
    if not s:
        return "-"
    if s.startswith("[") and s.endswith("]"):
        try:
            parsed = json.loads(s.replace("'", '"'))
            if isinstance(parsed, list):
                filtered = [str(v) for v in parsed if v]
                return sep.join(filtered) if filtered else "-"
        except Exception:
            pass
    return s


def normalize_analysis(raw: dict) -> dict:
    return {
        "summary":            _to_str(raw.get("summary", "-")),
        "verdict":            _to_str(raw.get("verdict", "Unknown")),
        "reason":             _to_str(raw.get("reason", "-")),
        "mitre_tactic":       _to_str(raw.get("mitre_tactic", "-")),
        "mitre_technique":    _to_str(raw.get("mitre_technique", "-")),
        "playbook_steps":     raw.get("playbook_steps") if isinstance(raw.get("playbook_steps"), list)
                              else [raw["playbook_steps"]] if isinstance(raw.get("playbook_steps"), str)
                              else [],
        "recommended_action": raw.get("recommended_action", "-"),
    }


def extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if block:
        try:
            return json.loads(block.group(1).strip())
        except Exception:
            pass
    obj = re.search(r'\{[\s\S]*\}', text)
    if obj:
        try:
            return json.loads(obj.group())
        except Exception:
            pass
    return {"raw_response": text}


async def ask_llm(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        })
        return response.json()["response"]


_MITRE_KEYS = ("mitre_tactic", "mitre_technique")

async def _ensure_thai(normalized: dict) -> dict:
    for attempt in range(3):
        non_mitre_chinese = any(
            _has_chinese(str(v))
            for k, v in normalized.items()
            if k not in _MITRE_KEYS
        )
        if not non_mitre_chinese:
            break
        logger.warning(f"[LLM] Chinese detected (attempt {attempt + 1}/3) — re-translating to Thai")
        mitre_tactic    = normalized.get("mitre_tactic",    "-")
        mitre_technique = normalized.get("mitre_technique", "-")
        prompt = (
            "You are a professional translator. Your task:\n"
            "1. Read the JSON below.\n"
            "2. Translate every Chinese string value to Thai language.\n"
            "3. Output ONLY the translated JSON. No markdown, no explanation.\n"
            "4. Keep all JSON keys exactly the same.\n"
            "5. Keep 'True Positive' and 'False Positive' values unchanged.\n\n"
            "JSON:\n"
            + json.dumps(normalized, ensure_ascii=False)
        )
        result = await ask_llm(prompt)
        analysis2 = extract_json(result)
        if "raw_response" not in analysis2:
            normalized = normalize_analysis(analysis2)
            normalized["mitre_tactic"]    = mitre_tactic
            normalized["mitre_technique"] = mitre_technique
    if any(_has_chinese(str(v)) for k, v in normalized.items() if k not in _MITRE_KEYS):
        logger.error("[LLM] Chinese still present after 3 translation attempts")
    return normalized


# ── Basic endpoints ───────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "RTARF AI-SOC running"}

@app.post("/trigger-report")
async def trigger_report():
    await daily_report_job()
    return {"status": "Report job executed"}

@app.get("/scheduler-status")
def scheduler_status():
    job = scheduler.get_job("daily_report")
    if job:
        return {
            "status": "running",
            "next_run": str(job.next_run_time),
            "timezone": "Asia/Bangkok (ICT)",
        }
    return {"status": "job not found"}


# ── Alert store endpoints ─────────────────────────────────────────
@app.get("/alerts")
def get_alerts():
    """ดึง state ของทุก alert (status + analysis)"""
    return db.get_all_alerts()

@app.get("/alerts/{alert_id}/analysis")
def get_alert_analysis(alert_id: str):
    """ดึง cached analysis และ status ของ alert"""
    entry = db.get_alert(alert_id)
    if not entry:
        return {"status": "OPEN", "analysis": None}
    return {
        "status":      entry.get("status", "OPEN"),
        "analysis":    entry.get("analysis"),
        "analyzed_at": entry.get("analyzed_at"),
    }

@app.get("/alerts/{alert_id}/audit")
def get_alert_audit(alert_id: str):
    """ดึง audit log ของ alert"""
    return db.get_audit_log(alert_id)

@app.post("/alerts/{alert_id}/status")
def update_alert_status(alert_id: str, body: StatusUpdate):
    """อัปเดต status ของ alert (OPEN / ACKNOWLEDGED / CLOSED)"""
    valid = {"OPEN", "ACKNOWLEDGED", "CLOSED"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"status must be one of {valid}")
    db.update_status(alert_id, body.status, actor="analyst")
    return {"ok": True, "alert_id": alert_id, "status": body.status}


# ── LLM prompts ───────────────────────────────────────────────────
PROMPT_RULES = """
กฎบังคับ (ห้ามละเมิด):
1. mitre_tactic ต้องเป็น string ภาษาอังกฤษเท่านั้น เช่น Credential Access, Lateral Movement ห้ามเป็น array หรือภาษาอื่น
2. mitre_technique ต้องเป็น string ภาษาอังกฤษเท่านั้น เช่น T1110, T1078 ห้ามเป็น array หรือภาษาอื่น
3. verdict ต้องเป็น True Positive หรือ False Positive เท่านั้น
4. ตอบ field summary, reason, recommended_action, playbook_steps เป็นภาษาไทยเท่านั้น ห้ามใช้ภาษาจีนหรือภาษาอื่น"""

PROMPT_TEMPLATE = """{
  "summary": "สรุปสั้นๆ ว่าเกิดอะไรขึ้น",
  "verdict": "True Positive",
  "reason": "เหตุผลที่ตัดสิน",
  "mitre_tactic": "Credential Access",
  "mitre_technique": "T1110",
  "recommended_action": "สิ่งที่ analyst ควรทำ"
}"""

PROMPT_TEMPLATE_FULL = """{
  "summary": "สรุปสั้นๆ ว่าเกิดอะไรขึ้น",
  "verdict": "True Positive",
  "reason": "เหตุผลที่ตัดสิน",
  "mitre_tactic": "Credential Access",
  "mitre_technique": "T1110",
  "playbook_steps": ["ขั้นตอนที่ 1", "ขั้นตอนที่ 2", "ขั้นตอนที่ 3"],
  "recommended_action": "สิ่งที่ analyst ควรทำทันที"
}"""


# ── Analyze endpoints ─────────────────────────────────────────────
@app.post("/analyze")
async def analyze_alert(alert: Alert):
    prompt = (
        "คุณคือ SOC Analyst ผู้เชี่ยวชาญด้านความมั่นคงปลอดภัยไซเบอร์\n"
        "วิเคราะห์ security alert ต่อไปนี้และตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น\n\n"
        "Alert:\n"
        f"- ชื่อ: {alert.name}\n"
        f"- ความรุนแรง: {alert.severity}\n"
        f"- หมวดหมู่: {alert.category}\n"
        f"- รายละเอียด: {alert.description}\n"
        + PROMPT_RULES + "\n\n"
        "ตอบในรูปแบบ JSON นี้เท่านั้น:\n"
        + PROMPT_TEMPLATE
    )
    result = await ask_llm(prompt)
    analysis = extract_json(result)
    normalized = normalize_analysis(analysis) if "raw_response" not in analysis else analysis
    if "raw_response" not in normalized:
        _collect_alert(alert, normalized)
    return {
        "alert_id":   alert.id,
        "alert_name": alert.name,
        "severity":   alert.severity,
        "analysis":   normalized,
    }

@app.get("/test")
async def test_with_mock():
    from mock_alerts import MOCK_ALERTS
    alert = Alert(**MOCK_ALERTS[0])
    return await analyze_alert(alert)


# ── RAG ───────────────────────────────────────────────────────────
from langchain_ollama import OllamaEmbeddings
import chromadb

def get_playbook_steps(query: str, n_results: int = 3) -> str:
    embeddings = OllamaEmbeddings(model="nomic-embed-text")
    client = chromadb.PersistentClient(path="./chroma_db")
    collection = client.get_collection("playbook")
    query_embed = embeddings.embed_query(query)
    results = collection.query(query_embeddings=[query_embed], n_results=n_results)
    docs = results["documents"][0]
    return "\n\n---\n\n".join(docs)

def get_playbook_steps_safe(query: str, n_results: int = 3) -> str:
    context = get_playbook_steps(query, n_results)
    if _has_chinese(context):
        logger.warning("[RAG] Playbook context contains Chinese — skipping")
        return "(ไม่พบ playbook ที่ตรงกัน — วิเคราะห์จากข้อมูล alert โดยตรง)"
    return context


@app.post("/analyze-full")
async def analyze_full(alert: Alert):
    query = f"{alert.category} {alert.name} {alert.description}"
    playbook_context = get_playbook_steps_safe(query)

    prompt = (
        "คุณคือ SOC Analyst ผู้เชี่ยวชาญด้านความมั่นคงปลอดภัยไซเบอร์\n"
        "วิเคราะห์ security alert ต่อไปนี้โดยอ้างอิงจาก playbook ของหน่วย และตอบเป็น JSON เท่านั้น\n\n"
        "Alert:\n"
        f"- ชื่อ: {alert.name}\n"
        f"- ความรุนแรง: {alert.severity}\n"
        f"- หมวดหมู่: {alert.category}\n"
        f"- รายละเอียด: {alert.description}\n\n"
        f"Playbook ที่เกี่ยวข้อง:\n{playbook_context}\n"
        + PROMPT_RULES + "\n\n"
        "ตอบในรูปแบบ JSON นี้เท่านั้น:\n"
        + PROMPT_TEMPLATE_FULL
    )

    result = await ask_llm(prompt)
    analysis = extract_json(result)
    normalized = normalize_analysis(analysis) if "raw_response" not in analysis else analysis
    normalized = await _ensure_thai(normalized)

    analyzed_at = datetime.now(timezone.utc).isoformat()
    db.save_analysis(alert.id, normalized, analyzed_at)
    db.add_audit_log(alert.id, "ANALYZED", detail=f"verdict={normalized.get('verdict', '-')}")

    if "raw_response" not in normalized:
        _collect_alert(alert, normalized)

    return {
        "alert_id":   alert.id,
        "alert_name": alert.name,
        "severity":   alert.severity,
        "analysis":   normalized,
    }

@app.get("/test-full")
async def test_full():
    from mock_alerts import MOCK_ALERTS
    alert = Alert(**MOCK_ALERTS[0])
    return await analyze_full(alert)