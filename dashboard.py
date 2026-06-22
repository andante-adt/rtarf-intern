# dashboard.py
import streamlit as st
import httpx
import ast
from mock_alerts import MOCK_ALERTS
from datetime import datetime, timezone, timedelta

TH_TZ = timezone(timedelta(hours=7))

st.set_page_config(
    page_title="RTAF-SOC | Alert Triage",
    layout="wide",
    initial_sidebar_state="expanded"
)

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
html, body, [class*="css"] { font-family: 'Inter', sans-serif; font-size: 15px; }
.stApp { background-color: #0a0e1a; }
section[data-testid="stSidebar"] { background-color: #0d1117; border-right: 1px solid #1e2d3d; }
#MainMenu { visibility: hidden; }
footer { visibility: hidden; }
header { background-color: #0a0e1a !important; box-shadow: none !important; }
[data-testid="stDeployButton"] { display:none !important; }
[data-testid="stToolbar"] { display:none !important; }
.block-container { padding: 3.5rem 1.8rem 1rem; max-width: 100%; }
.top-bar { display:flex; align-items:center; justify-content:space-between; padding:10px 0 14px; border-bottom:1px solid #1e2d3d; margin-bottom:16px; }
.top-bar-logo { font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:600; color:#e2e8f0; letter-spacing:0.04em; }
.top-bar-sub  { font-size:13px; color:#4a6080; font-family:'JetBrains Mono',monospace; letter-spacing:0.06em; }
.top-bar-right { font-family:'JetBrains Mono',monospace; font-size:13px; color:#4a6080; }
.status-dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:#22c55e; margin-right:6px; box-shadow:0 0 6px #22c55e; }
.section-label { font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:500; color:#4a6080; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:8px; margin-top:4px; }
.alert-header { background:#0d1521; border:1px solid #1e2d3d; border-left:3px solid #f59e0b; border-radius:6px; padding:14px 18px; margin-bottom:12px; }
.alert-header.critical { border-left-color:#ef4444; }
.alert-header.high     { border-left-color:#f59e0b; }
.alert-header.medium   { border-left-color:#3b82f6; }
.alert-header.low      { border-left-color:#22c55e; }
.alert-name { font-size:17px; font-weight:600; color:#e2e8f0; margin-bottom:5px; }
.alert-meta { font-family:'JetBrains Mono',monospace; font-size:13px; color:#4a6080; margin-bottom:9px; }
.alert-desc { font-size:14px; color:#8898aa; line-height:1.6; }
.badge { display:inline-block; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:500; padding:3px 9px; border-radius:3px; margin-right:6px; letter-spacing:0.05em; }
.badge-critical { background:rgba(239,68,68,0.15);  color:#ef4444; border:1px solid rgba(239,68,68,0.3); }
.badge-high     { background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); }
.badge-medium   { background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); }
.badge-low      { background:rgba(34,197,94,0.15);  color:#22c55e; border:1px solid rgba(34,197,94,0.3); }
.badge-open     { background:rgba(148,163,184,0.1); color:#94a3b8; border:1px solid rgba(148,163,184,0.2); }
.badge-tp       { background:rgba(239,68,68,0.15);  color:#ef4444; border:1px solid rgba(239,68,68,0.3); }
.badge-fp       { background:rgba(34,197,94,0.15);  color:#22c55e; border:1px solid rgba(34,197,94,0.3); }
.badge-mitre    { background:rgba(124,58,237,0.15); color:#a78bfa; border:1px solid rgba(124,58,237,0.3); }
.result-card { background:#0d1521; border:1px solid #1e2d3d; border-radius:6px; padding:16px 18px; margin-bottom:10px; }
.result-card-title { font-family:'JetBrains Mono',monospace; font-size:12px; color:#4a6080; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:7px; }
.result-card-body { font-size:14px; color:#c9d8e8; line-height:1.7; }
.pb-step { display:flex; gap:14px; align-items:flex-start; padding:10px 0; border-bottom:1px solid #111d2c; }
.pb-step:last-child { border-bottom:none; }
.pb-num { font-family:'JetBrains Mono',monospace; font-size:12px; color:#4a6080; min-width:26px; padding-top:2px; }
.pb-text { font-size:14px; color:#c9d8e8; line-height:1.65; }
.action-box { background:rgba(13,148,136,0.08); border:1px solid rgba(13,148,136,0.25); border-left:3px solid #0d9488; border-radius:6px; padding:14px 18px; font-size:14px; color:#5eead4; line-height:1.8; }
.stButton > button { background:#0d9488 !important; color:white !important; border:none !important; border-radius:5px !important; font-family:'JetBrains Mono',monospace !important; font-size:13px !important; font-weight:500 !important; letter-spacing:0.06em !important; padding:10px 22px !important; height:auto !important; }
.stButton > button:hover { background:#0f766e !important; }
.sidebar-label { font-family:'JetBrains Mono',monospace; font-size:12px; color:#4a6080; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:6px; }
.alert-item { display:flex; align-items:flex-start; gap:10px; padding:9px 10px; border-radius:5px; border:1px solid transparent; margin-bottom:2px; }
.alert-item.active { background:#0d1521; border-color:#1e2d3d; }
.alert-item:hover { background:#111d2c; }
.alert-dot { width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0; }
.alert-item-name { font-size:13px; color:#c9d8e8; line-height:1.45; font-weight:500; }
.alert-item-meta { font-family:'JetBrains Mono',monospace; font-size:11px; color:#4a6080; margin-top:2px; }
.div-line { border:none; border-top:1px solid #1e2d3d; margin:16px 0; }
section[data-testid="stSidebar"] .stButton { height:0 !important; overflow:visible !important; margin:0 !important; padding:0 !important; }
section[data-testid="stSidebar"] .stButton > button { position:relative !important; top:-60px !important; height:58px !important; width:100% !important; opacity:0 !important; cursor:pointer !important; border:none !important; background:transparent !important; padding:0 !important; min-height:0 !important; box-shadow:none !important; }
section[data-testid="stSidebar"] .stButton > button:hover { opacity:0.08 !important; background:#c9d8e8 !important; border-radius:5px !important; }
section[data-testid="stSidebar"] button[data-testid="baseButton-header"] { display:none !important; }
[data-testid="collapsedControl"] { background:#0d1117 !important; border:1px solid #1e2d3d !important; border-left:none !important; border-radius:0 6px 6px 0 !important; }
[data-testid="collapsedControl"] svg { fill:#c9d8e8 !important; color:#c9d8e8 !important; }
</style>
"""

st.markdown(CSS, unsafe_allow_html=True)

SIDEBAR_JS = """
<script>
(function() {
    var btn = null;
    function createBtn() {
        if (document.getElementById('__soc_sb_btn')) return;
        btn = document.createElement('button');
        btn.id = '__soc_sb_btn';
        btn.innerHTML = '&#9776;';
        btn.title = 'Open Alert Queue';
        btn.style.cssText = 'position:fixed;top:14px;left:8px;z-index:99999;' +
            'background:#0d1117;border:1px solid #1e2d3d;color:#c9d8e8;' +
            'font-size:16px;width:34px;height:34px;border-radius:6px;' +
            'cursor:pointer;display:none;align-items:center;justify-content:center;' +
            'box-shadow:0 2px 8px rgba(0,0,0,0.5);transition:background 0.15s;';
        btn.onmouseover = function(){ this.style.background='#111d2c'; };
        btn.onmouseout  = function(){ this.style.background='#0d1117'; };
        btn.onclick = function() {
            var ctrl = document.querySelector('[data-testid="collapsedControl"]');
            if (ctrl) ctrl.click();
        };
        document.body.appendChild(btn);
    }
    function check() {
        if (!btn) { createBtn(); if (!btn) return; }
        var sb = document.querySelector('[data-testid="stSidebar"]');
        if (!sb) { btn.style.display = 'none'; return; }
        var collapsed = sb.getBoundingClientRect().left < -10;
        btn.style.display = collapsed ? 'flex' : 'none';
    }
    setInterval(check, 400);
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(check, 500); });
})();
</script>
"""
st.markdown(SIDEBAR_JS, unsafe_allow_html=True)


def _sanitize_mitre(val):
    if not val or val in ("-", "", "[]", "null", "None", "none"):
        return "-"
    v = val.strip()
    if v.startswith("[") and v.endswith("]"):
        try:
            parsed = ast.literal_eval(v)
            if isinstance(parsed, list) and parsed:
                return ", ".join(str(x) for x in parsed if x)
        except Exception:
            pass
    return v if v else "-"


SEV_DOT = {"Critical": "#ef4444", "High": "#f59e0b", "Medium": "#3b82f6", "Low": "#22c55e"}

if "selected_alert" not in st.session_state:
    st.session_state.selected_alert = MOCK_ALERTS[0]["name"]

# Top bar
now_str = datetime.now(TH_TZ).strftime("%Y-%m-%d %H:%M:%S ICT")
st.markdown(
    '<div class="top-bar">'
    '<div class="top-bar-left"><div>'
    '<div class="top-bar-logo">RTAF-SOC // Alert Triage Platform</div>'
    '<div class="top-bar-sub">BLUE TEAM UNIT · CYBER PROTECTION</div>'
    '</div></div>'
    '<div class="top-bar-right"><span class="status-dot"></span>SYSTEM ONLINE · ' + now_str + '</div>'
    '</div>',
    unsafe_allow_html=True
)

# Sidebar
with st.sidebar:
    st.markdown('<div class="sidebar-label">Alert Queue</div>', unsafe_allow_html=True)

    for a in MOCK_ALERTS:
        dot  = SEV_DOT.get(a["severity"], "#94a3b8")
        time = a["observation_date"][11:16]
        is_active = a["name"] == st.session_state.selected_alert
        active_class = " active" if is_active else ""
        glow = f";box-shadow:0 0 5px {dot}88" if is_active else ""
        st.markdown(
            f'<div class="alert-item{active_class}">'
            f'<div class="alert-dot" style="background:{dot}{glow}"></div>'
            f'<div>'
            f'<div class="alert-item-name">{a["name"]}</div>'
            f'<div class="alert-item-meta">{a["severity"].upper()} &nbsp;·&nbsp; {time}</div>'
            f'</div></div>',
            unsafe_allow_html=True
        )
        if not is_active:
            if st.button(" ", key="btn_" + a["id"], use_container_width=True):
                st.session_state.selected_alert = a["name"]
                st.rerun()

    st.markdown('<hr class="div-line">', unsafe_allow_html=True)
    st.markdown('<div class="sidebar-label">Queue Status</div>', unsafe_allow_html=True)
    st.markdown(
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:13px;color:#4a6080;line-height:2.2">'
        'OPEN &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style="color:#e2e8f0">' + str(len(MOCK_ALERTS)) + '</span><br>'
        'CRITICAL &nbsp; <span style="color:#ef4444">' + str(sum(1 for x in MOCK_ALERTS if x["severity"]=="Critical")) + '</span><br>'
        'HIGH &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style="color:#f59e0b">' + str(sum(1 for x in MOCK_ALERTS if x["severity"]=="High")) + '</span><br>'
        'MEDIUM &nbsp;&nbsp;&nbsp; <span style="color:#60a5fa">' + str(sum(1 for x in MOCK_ALERTS if x["severity"]=="Medium")) + '</span>'
        '</div>',
        unsafe_allow_html=True
    )

alert = next(a for a in MOCK_ALERTS if a["name"] == st.session_state.selected_alert)

# Alert header
sev_class = alert["severity"].lower()
st.markdown('<div class="section-label">Incoming Alert</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="alert-header ' + sev_class + '">'
    '<div class="alert-name">' + alert["name"] + '</div>'
    '<div class="alert-meta">' + alert["observation_date"] + ' &nbsp;·&nbsp; '
    + alert["issue_domain"] + ' &nbsp;·&nbsp; ' + alert["detection_method"] + '</div>'
    '<div style="margin-bottom:9px">'
    '<span class="badge badge-' + sev_class + '">' + alert["severity"] + '</span>'
    '<span class="badge badge-open">OPEN</span>'
    '<span class="badge badge-open">' + alert["category"] + '</span>'
    '</div>'
    '<div class="alert-desc">' + alert["description"] + '</div>'
    '</div>',
    unsafe_allow_html=True
)

# Analyze button
col_btn, _ = st.columns([1, 4])
with col_btn:
    analyze = st.button("RUN ANALYSIS", use_container_width=True)

st.markdown('<hr class="div-line">', unsafe_allow_html=True)

# Analysis result
if analyze:
    with st.spinner(""):
        try:
            resp     = httpx.post("http://127.0.0.1:8000/analyze-full", json=alert, timeout=180)
            analysis = resp.json()["analysis"]

            verdict   = str(analysis.get("verdict", ""))
            tactic    = str(analysis.get("mitre_tactic", "-") or "-")
            technique = str(analysis.get("mitre_technique", "-") or "-")
            summary   = str(analysis.get("summary", "-") or "-")
            reason    = str(analysis.get("reason", "-") or "-")
            steps     = analysis.get("playbook_steps", [])
            action    = analysis.get("recommended_action", "-")
            if isinstance(action, list):
                action = "<br>".join("&rarr; " + item for item in action)
            else:
                action = "&rarr; " + str(action)

            is_tp   = "true positive" in verdict.lower()
            v_badge = '<span class="badge badge-tp">TRUE POSITIVE</span>' if is_tp else '<span class="badge badge-fp">FALSE POSITIVE</span>'
            tdisp   = _sanitize_mitre(tactic)
            techdisp= _sanitize_mitre(technique)
            m_badge = '<span class="badge badge-mitre">' + tdisp + " / " + techdisp + '</span>'

            st.markdown('<div class="section-label">Triage Result</div>', unsafe_allow_html=True)
            c1, c2 = st.columns(2)
            with c1:
                st.markdown(
                    '<div class="result-card"><div class="result-card-title">Verdict</div>'
                    '<div style="margin-bottom:7px">' + v_badge + '</div>'
                    '<div class="result-card-body">' + reason + '</div></div>',
                    unsafe_allow_html=True
                )
            with c2:
                st.markdown(
                    '<div class="result-card"><div class="result-card-title">MITRE ATT&amp;CK</div>'
                    '<div style="margin-bottom:7px">' + m_badge + '</div>'
                    '<div class="result-card-body">' + summary + '</div></div>',
                    unsafe_allow_html=True
                )

            st.markdown('<hr class="div-line">', unsafe_allow_html=True)
            st.markdown('<div class="section-label">Playbook — CPT Handbook</div>', unsafe_allow_html=True)
            if isinstance(steps, list):
                html = "".join(
                    '<div class="pb-step"><div class="pb-num">' + str(i).zfill(2) + '</div>'
                    '<div class="pb-text">' + s + '</div></div>'
                    for i, s in enumerate(steps, 1)
                )
            else:
                html = '<div class="pb-text">' + str(steps) + '</div>'
            st.markdown('<div class="result-card">' + html + '</div>', unsafe_allow_html=True)

            st.markdown('<hr class="div-line">', unsafe_allow_html=True)
            st.markdown('<div class="section-label">Recommended Action</div>', unsafe_allow_html=True)
            st.markdown('<div class="action-box">' + action + '</div>', unsafe_allow_html=True)

        except Exception as e:
            st.markdown(
                '<div class="action-box" style="border-left-color:#ef4444;color:#ef4444">ERROR: ' + str(e) + '</div>',
                unsafe_allow_html=True
            )