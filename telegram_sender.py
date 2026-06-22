# telegram_sender.py
import httpx
import os
from dotenv import load_dotenv
from report_generator import generate_daily_report
from datetime import datetime, timezone, timedelta

load_dotenv()

TELEGRAM_TOKEN   = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

TH_TZ = timezone(timedelta(hours=7))

async def send_telegram_message(text: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    async with httpx.AsyncClient() as client:
        await client.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": text,
            "parse_mode": "HTML"
        })

async def send_telegram_document(file_path: str, caption: str = ""):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendDocument"
    async with httpx.AsyncClient(timeout=60) as client:
        with open(file_path, "rb") as f:
            await client.post(url, data={
                "chat_id": TELEGRAM_CHAT_ID,
                "caption": caption
            }, files={"document": f})

async def send_daily_report(alerts_summary: list):
    now = datetime.now(TH_TZ)
    date_str = now.strftime("%d/%m/%Y %H:%M")
    filename = f"report_{now.strftime('%Y%m%d_%H%M')}.pdf"

    # Generate PDF
    generate_daily_report(alerts_summary, filename)

    # สรุปสั้น ๆ ส่งก่อน
    total     = len(alerts_summary)
    true_pos  = sum(1 for a in alerts_summary if "True"  in a.get("verdict", ""))
    critical  = sum(1 for a in alerts_summary if a.get("severity") == "Critical")
    high      = sum(1 for a in alerts_summary if a.get("severity") == "High")

    summary_text = (
        f"🛡️ <b>RTARF AI-SOC Daily Report</b>\n"
        f"📅 {date_str}\n\n"
        f"📊 <b>สรุปภาพรวม</b>\n"
        f"• Alert ทั้งหมด: {total}\n"
        f"• True Positive: {true_pos}\n"
        f"• Critical: {critical}\n"
        f"• High: {high}\n\n"
        f"📎 รายงานฉบับเต็มแนบมาด้านล่างครับ"
    )

    await send_telegram_message(summary_text)
    await send_telegram_document(filename, caption=f"Daily Report {date_str}")

    # ลบไฟล์ชั่วคราว
    os.remove(filename)
    print(f"✅ ส่ง report ไป Telegram เรียบร้อย")


# ทดสอบ
if __name__ == "__main__":
    import asyncio

    test_data = [
        {
            "alert_name": "Multiple Failed Login Attempts",
            "severity": "High",
            "verdict": "True Positive",
            "mitre_tactic": "Credential Access",
            "mitre_technique": "T1110",
            "recommended_action": "ปรับเปลี่ยนการตั้งค่า SSH ให้ใช้ MFA"
        },
        {
            "alert_name": "USB Storage Device Connected",
            "severity": "Medium",
            "verdict": "True Positive",
            "mitre_tactic": "Collection",
            "mitre_technique": "T1039",
            "recommended_action": "ตรวจสอบและ block USB device"
        },
        {
            "alert_name": "Privilege Escalation Attempt",
            "severity": "Critical",
            "verdict": "True Positive",
            "mitre_tactic": "Privilege Escalation",
            "mitre_technique": "T1134",
            "recommended_action": "Isolate host SRV-DB-01 ทันที"
        },
    ]

    asyncio.run(send_daily_report(test_data))