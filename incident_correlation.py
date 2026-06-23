# incident_correlation.py
from datetime import datetime, timezone

SEVERITY_RANK = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}


def _parse_ts(ts: str) -> datetime:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def build_incidents(
    alerts: list[dict],
    analyses: dict[str, dict],
    time_window_minutes: int | None = None,
) -> list[dict]:
    """
    จัดกลุ่ม alert เป็น incident ถ้ามี source_ip ตรงกัน หรือ mitre_technique
    (จาก analysis ที่บันทึกไว้ใน DB) ตรงกัน
    """
    n = len(alerts)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    def technique_of(alert_id: str) -> str | None:
        entry = analyses.get(alert_id)
        if not entry or not entry.get("analysis"):
            return None
        t = entry["analysis"].get("mitre_technique")
        return t if t and t not in ("-", "None", "null") else None

    def within_window(a: dict, b: dict) -> bool:
        if time_window_minutes is None:
            return True
        try:
            delta = abs(
                (_parse_ts(a["observation_date"]) - _parse_ts(b["observation_date"])).total_seconds()
            )
            return delta <= time_window_minutes * 60
        except Exception:
            return True

    for i in range(n):
        for j in range(i + 1, n):
            a, b = alerts[i], alerts[j]
            if not within_window(a, b):
                continue
            same_ip = bool(a.get("source_ip")) and a.get("source_ip") == b.get("source_ip")
            ta, tb = technique_of(a["id"]), technique_of(b["id"])
            same_technique = bool(ta) and ta == tb
            if same_ip or same_technique:
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)

    incidents = []
    for members in groups.values():
        if len(members) < 2:
            continue  # alert เดี่ยว ไม่ถือเป็น incident

        member_alerts = [alerts[i] for i in members]
        ids = sorted(a["id"] for a in member_alerts)
        techniques = sorted({technique_of(aid) for aid in ids if technique_of(aid)})
        ips = sorted({a.get("source_ip") for a in member_alerts if a.get("source_ip")})
        max_sev = max(member_alerts, key=lambda a: SEVERITY_RANK.get(a.get("severity"), 0))["severity"]
        statuses = {analyses.get(aid, {}).get("status", "OPEN") for aid in ids}
        incident_status = "CLOSED" if statuses == {"CLOSED"} else ("OPEN" if "OPEN" in statuses else "ACKNOWLEDGED")
        earliest = min(member_alerts, key=lambda a: a.get("observation_date", ""))

        incidents.append({
            "incident_id": "incident-" + "-".join(ids),
            "alert_ids": ids,
            "alert_count": len(ids),
            "shared_source_ips": ips,
            "shared_mitre_techniques": techniques,
            "max_severity": max_sev,
            "status": incident_status,
            "earliest_observed": earliest.get("observation_date"),
            "alerts": member_alerts,
        })

    incidents.sort(key=lambda inc: SEVERITY_RANK.get(inc["max_severity"], 0), reverse=True)
    return incidents