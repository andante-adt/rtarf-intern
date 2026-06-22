# report_generator.py
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime, timezone, timedelta

# Register font ภาษาไทย
pdfmetrics.registerFont(TTFont("Sarabun", "Sarabun-Regular.ttf"))

TH_TZ = timezone(timedelta(hours=7))

def get_thai_time():
    return datetime.now(TH_TZ)


# ── Cell helpers — ใช้ Paragraph แทน plain string เพื่อให้ตัดบรรทัดได้ ──
def _ph(text, size=10):
    """Header cell — ตัวอักษรขาว"""
    return Paragraph(str(text), ParagraphStyle(
        "hdr",
        fontName="Sarabun",
        fontSize=size,
        textColor=colors.white,
        leading=size * 1.5,
        wordWrap="CJK",
    ))

def _pd(text, size=10, color="#1E293B"):
    """Data cell — ตัดบรรทัดอัตโนมัติ"""
    return Paragraph(str(text), ParagraphStyle(
        "dat",
        fontName="Sarabun",
        fontSize=size,
        textColor=colors.HexColor(color),
        leading=size * 1.5,
        wordWrap="CJK",
    ))

def _pl(text, size=10):
    """Label cell (คอลัมน์ซ้าย) — ตัวหนา"""
    return Paragraph(str(text), ParagraphStyle(
        "lbl",
        fontName="Sarabun",
        fontSize=size,
        textColor=colors.HexColor("#1E3252"),
        leading=size * 1.5,
        wordWrap="CJK",
    ))


def generate_daily_report(alerts_summary: list, output_path: str = "daily_report.pdf"):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )

    story = []
    now = get_thai_time()
    date_str = now.strftime("%d/%m/%Y %H:%M")

    def head_style(size=10, color="#000000", align=0, space_before=0, space_after=4):
        return ParagraphStyle(
            f"h{size}",
            fontName="Sarabun",
            fontSize=size,
            textColor=colors.HexColor(color),
            alignment=align,
            spaceBefore=space_before,
            spaceAfter=space_after,
            leading=size * 1.6,
        )

    # ── หัวรายงาน ─────────────────────────────────────────────────
    story.append(Paragraph("RTARF AI-SOC — Daily Security Report",
                            head_style(18, "#0D9488", space_after=4)))
    story.append(Paragraph(f"รายงานประจำวัน: {date_str}",
                            head_style(11, "#64748B", space_after=2)))
    story.append(Paragraph("Blue Team Unit · Cyber Protection Team",
                            head_style(11, "#64748B", space_after=6)))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0D9488")))
    story.append(Spacer(1, 0.4*cm))

    # ── สรุปภาพรวม ────────────────────────────────────────────────
    total     = len(alerts_summary)
    true_pos  = sum(1 for a in alerts_summary if "True"  in a.get("verdict", ""))
    false_pos = sum(1 for a in alerts_summary if "False" in a.get("verdict", ""))
    critical  = sum(1 for a in alerts_summary if a.get("severity") == "Critical")
    high      = sum(1 for a in alerts_summary if a.get("severity") == "High")
    medium    = sum(1 for a in alerts_summary if a.get("severity") == "Medium")

    story.append(Paragraph("1. สรุปภาพรวม",
                            head_style(13, "#1E3252", space_before=8, space_after=6)))

    BASE_STYLE = [
        ("FONTNAME",      (0, 0), (-1, -1), "Sarabun"),
        ("FONTSIZE",      (0, 0), (-1, -1), 10),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]

    def make_table(data, col_widths, header_color):
        t = Table(data, colWidths=col_widths)
        t.setStyle(TableStyle(BASE_STYLE + [
            ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor(header_color)),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
        ]))
        return t

    summary_data = [
        [_ph("รายการ"),        _ph("จำนวน", )],
        [_pd("Alert ทั้งหมด"), _pd(str(total))],
        [_pd("True Positive"),  _pd(str(true_pos))],
        [_pd("False Positive"), _pd(str(false_pos))],
        [_pd("Critical"),       _pd(str(critical))],
        [_pd("High"),           _pd(str(high))],
        [_pd("Medium"),         _pd(str(medium))],
    ]
    story.append(make_table(summary_data, [10*cm, 5*cm], "#1E3252"))
    story.append(Spacer(1, 0.4*cm))

    # ── MITRE ATT&CK ──────────────────────────────────────────────
    story.append(Paragraph("2. MITRE ATT&CK Techniques ที่พบ",
                            head_style(13, "#1E3252", space_before=8, space_after=6)))

    mitre_count: dict = {}
    for a in alerts_summary:
        key = f"{a.get('mitre_tactic', '-')} / {a.get('mitre_technique', '-')}"
        mitre_count[key] = mitre_count.get(key, 0) + 1

    mitre_data = [[_ph("Tactic / Technique"), _ph("จำนวน")]]
    for k, v in sorted(mitre_count.items(), key=lambda x: -x[1]):
        mitre_data.append([_pd(k), _pd(str(v))])

    story.append(make_table(mitre_data, [12*cm, 3*cm], "#7C3AED"))
    story.append(Spacer(1, 0.4*cm))

    # ── รายละเอียด Alert ──────────────────────────────────────────
    story.append(Paragraph("3. รายละเอียด Alert",
                            head_style(13, "#1E3252", space_before=8, space_after=6)))

    sev_colors = {
        "Critical": "#EF4444",
        "High":     "#F59E0B",
        "Medium":   "#3B82F6",
        "Low":      "#22C55E",
    }

    for i, alert in enumerate(alerts_summary, 1):
        sev = alert.get("severity", "")
        sc  = sev_colors.get(sev, "#64748B")

        action = alert.get("recommended_action", "-")
        if isinstance(action, list):
            action = " / ".join(action)

        # หัวตาราง (ชื่อ alert) — ข้อความขาวบนพื้นสี
        header_para = Paragraph(
            f"{i}. {alert.get('alert_name', '-')}",
            ParagraphStyle("ah", fontName="Sarabun", fontSize=10,
                           textColor=colors.white, leading=15, wordWrap="CJK")
        )

        alert_data = [
            [header_para, ""],
            [_pl("Severity"), _pd(sev)],
            [_pl("Verdict"),  _pd(alert.get("verdict", "-"))],
            [_pl("MITRE"),    _pd(f"{alert.get('mitre_tactic', '-')} / {alert.get('mitre_technique', '-')}")],
            [_pl("แนะนำ"),    _pd(action)],
        ]

        t = Table(alert_data, colWidths=[4*cm, 11*cm])
        t.setStyle(TableStyle(BASE_STYLE + [
            ("SPAN",          (0, 0), (1, 0)),
            ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor(sc)),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.3*cm))

    # ── Footer ────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1")))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"สร้างโดย RTARF AI-SOC System อัตโนมัติ · {date_str}",
        head_style(8, "#94A3B8", align=1)
    ))

    doc.build(story)
    return output_path


if __name__ == "__main__":
    test_data = [
        {
            "alert_name": "Multiple Failed Login Attempts",
            "severity": "High",
            "verdict": "True Positive",
            "mitre_tactic": "Credential Access",
            "mitre_technique": "T1110",
            "recommended_action": "ปรับเปลี่ยนการตั้งค่า SSH ให้ใช้ MFA และตรวจสอบ Active Directory สำหรับบัญชีที่อาจถูก compromise รวมถึงตรวจสอบ log ของ SSH server ย้อนหลัง 7 วัน"
        },
        {
            "alert_name": "USB Storage Device Connected",
            "severity": "Medium",
            "verdict": "True Positive",
            "mitre_tactic": "Collection",
            "mitre_technique": "T1039",
            "recommended_action": "ตรวจสอบและ block USB device โดยทันที และให้ผู้ใช้ 'sgt.somchai' เข้าใจความสำคัญของนโยบายการใช้งาน USB ในพื้นที่ปลอดภัย"
        },
        {
            "alert_name": "Privilege Escalation Attempt",
            "severity": "Critical",
            "verdict": "True Positive",
            "mitre_tactic": "Privilege Escalation",
            "mitre_technique": "T1134",
            "recommended_action": "Isolate host SRV-DB-01 ทันที และดำเนินการ forensic investigation เพื่อระบุ root cause และขอบเขตของการบุกรุก"
        },
    ]

    path = generate_daily_report(test_data, "test_report.pdf")
    print(f"✅ สร้าง PDF เรียบร้อย: {path}")