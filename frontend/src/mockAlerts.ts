import type { Alert } from './types'

// Mirror of mock_alerts.py — keep in sync with backend data
export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-001',
    name: 'Multiple Failed Login Attempts',
    severity: 'High',
    observation_date: '2025-06-11T02:14:33Z',
    issue_domain: 'Identity & Access',
    detection_method: 'Signature-based',
    category: 'Authentication Attack',
    description:
      "Detected 47 failed SSH login attempts from IP 192.168.10.55 targeting user 'admin' within 2 minutes.",
  },
  {
    id: 'alert-002',
    name: 'USB Storage Device Connected',
    severity: 'Medium',
    observation_date: '2025-06-11T08:42:17Z',
    issue_domain: 'Endpoint',
    detection_method: 'Behavioral',
    category: 'Data Exfiltration Risk',
    description:
      'Unauthorized USB mass storage device connected to workstation WS-042 in the secured operations room.',
  },
  {
    id: 'alert-003',
    name: 'Privilege Escalation Attempt',
    severity: 'Critical',
    observation_date: '2025-06-11T11:05:22Z',
    issue_domain: 'System Integrity',
    detection_method: 'Anomaly-based',
    category: 'Privilege Abuse',
    description:
      "Process 'svchost.exe' attempted to modify SYSTEM-level registry keys outside normal operation hours.",
  },
]