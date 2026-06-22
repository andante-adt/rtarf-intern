# database.py
import sqlite3
import json
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager

DB_FILE = Path("rtarf_soc.db")


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alert_store (
                id                 TEXT PRIMARY KEY,
                status             TEXT NOT NULL DEFAULT 'OPEN',
                analysis           TEXT,
                analyzed_at        TEXT,
                status_updated_at  TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id   TEXT,
                action     TEXT NOT NULL,
                actor      TEXT NOT NULL DEFAULT 'system',
                detail     TEXT,
                timestamp  TEXT NOT NULL
            )
        """)
    print("[DB] Initialized rtarf_soc.db")


def get_alert(alert_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM alert_store WHERE id = ?", (alert_id,)
        ).fetchone()
        if not row:
            return None
        return {
            "status":            row["status"],
            "analysis":          json.loads(row["analysis"]) if row["analysis"] else None,
            "analyzed_at":       row["analyzed_at"],
            "status_updated_at": row["status_updated_at"],
        }


def get_all_alerts() -> dict:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM alert_store").fetchall()
        return {
            row["id"]: {
                "status":      row["status"],
                "analysis":    json.loads(row["analysis"]) if row["analysis"] else None,
                "analyzed_at": row["analyzed_at"],
            }
            for row in rows
        }


def save_analysis(alert_id: str, analysis: dict, analyzed_at: str):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM alert_store WHERE id = ?", (alert_id,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE alert_store SET analysis = ?, analyzed_at = ? WHERE id = ?",
                (json.dumps(analysis, ensure_ascii=False), analyzed_at, alert_id),
            )
        else:
            conn.execute(
                "INSERT INTO alert_store (id, status, analysis, analyzed_at) VALUES (?, 'OPEN', ?, ?)",
                (alert_id, json.dumps(analysis, ensure_ascii=False), analyzed_at),
            )


def update_status(alert_id: str, status: str, actor: str = "system"):
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT status FROM alert_store WHERE id = ?", (alert_id,)
        ).fetchone()
        old_status = existing["status"] if existing else "OPEN"
        if existing:
            conn.execute(
                "UPDATE alert_store SET status = ?, status_updated_at = ? WHERE id = ?",
                (status, now, alert_id),
            )
        else:
            conn.execute(
                "INSERT INTO alert_store (id, status, status_updated_at) VALUES (?, ?, ?)",
                (alert_id, status, now),
            )
        conn.execute(
            "INSERT INTO audit_log (alert_id, action, actor, detail, timestamp) VALUES (?, ?, ?, ?, ?)",
            (alert_id, "STATUS_CHANGED", actor, f"{old_status} → {status}", now),
        )


def add_audit_log(alert_id: str, action: str, actor: str = "system", detail: str = ""):
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO audit_log (alert_id, action, actor, detail, timestamp) VALUES (?, ?, ?, ?, ?)",
            (alert_id, action, actor, detail, now),
        )


def get_audit_log(alert_id: str) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_log WHERE alert_id = ? ORDER BY timestamp ASC",
            (alert_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_all_audit_log() -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_log ORDER BY timestamp ASC",
        ).fetchall()
        return [dict(row) for row in rows]


def migrate_from_json(json_file: Path = Path("alert_store.json")):
    if not json_file.exists():
        print(f"[DB] {json_file} not found — skipping migration")
        return
    with open(json_file, encoding="utf-8") as f:
        data = json.load(f)
    migrated = 0
    for alert_id, entry in data.items():
        analysis    = entry.get("analysis")
        analyzed_at = entry.get("analyzed_at")
        status      = entry.get("status", "OPEN")
        with get_conn() as conn:
            existing = conn.execute(
                "SELECT id FROM alert_store WHERE id = ?", (alert_id,)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO alert_store (id, status, analysis, analyzed_at) VALUES (?, ?, ?, ?)",
                    (
                        alert_id, status,
                        json.dumps(analysis, ensure_ascii=False) if analysis else None,
                        analyzed_at,
                    ),
                )
                migrated += 1
    print(f"[DB] Migrated {migrated}/{len(data)} alerts from {json_file}")


if __name__ == "__main__":
    init_db()
    migrate_from_json()
    print("[DB] Done — rtarf_soc.db is ready")