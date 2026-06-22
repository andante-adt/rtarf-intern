# mock_alerts.py
# ตัวอย่าง alert จำลองจาก Wazuh/XSIAM format

MOCK_ALERTS = [
    {
        "id": "alert-001",
        "name": "Multiple Failed Login Attempts",
        "severity": "High",
        "issue_domain": "Identity & Access",
        "detection_method": "Signature-based",
        "category": "Authentication Attack",
        "observation_date": "2025-06-11T02:14:33Z",
        "description": "Detected 47 failed SSH login attempts from IP 192.168.10.55 targeting user 'admin' within 2 minutes.",
        "source_ip": "192.168.10.55",
        "target_user": "admin",
        "status": "Open"
    },
    {
        "id": "alert-002",
        "name": "USB Storage Device Connected",
        "severity": "Medium",
        "issue_domain": "Endpoint",
        "detection_method": "Anomaly-based",
        "category": "Policy Violation",
        "observation_date": "2025-06-11T08:42:11Z",
        "description": "USB mass storage device plugged into workstation WS-047 by user 'sgt.somchai'. Device not in approved whitelist.",
        "hostname": "WS-047",
        "target_user": "sgt.somchai",
        "status": "Open"
    },
    {
        "id": "alert-003",
        "name": "Privilege Escalation Attempt",
        "severity": "Critical",
        "issue_domain": "Endpoint",
        "detection_method": "Signature-based",
        "category": "Privilege Escalation",
        "observation_date": "2025-06-11T11:05:02Z",
        "description": "Process 'cmd.exe' attempted to execute with SYSTEM privileges via token impersonation on server SRV-DB-01.",
        "hostname": "SRV-DB-01",
        "process": "cmd.exe",
        "status": "Open"
    }
]