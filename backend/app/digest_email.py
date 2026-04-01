"""Signal CRM — Daily Digest Email + Alert Service"""
import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from app.config import get_settings

settings = get_settings()

SIGNAL_ICONS = {
    "hiring_spike":      "📈",
    "new_country_page":  "🌍",
    "pricing_change":    "💰",
    "new_product":       "🚀",
    "compliance_update": "⚖️",
    "leadership_change": "👤",
    "partner_page":      "🤝",
}

STRENGTH_COLOR = {"high": "#E50914", "medium": "#f5a623", "low": "#46d369"}

APP_URL = "https://signal-crm.pages.dev"


def _send_smtp(to_email: str, subject: str, html: str) -> bool:
    """Send email via SMTP. Returns True on success."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[Email] SMTP not configured — skipping email to {to_email}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as srv:
            srv.ehlo()
            srv.starttls(context=ctx)
            srv.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            srv.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())
        print(f"[Email] Sent '{subject}' → {to_email}")
        return True
    except Exception as e:
        print(f"[Email] SMTP error: {e}")
        return False


def _digest_html(user_name: str, signals: list, deals_active: int, pipeline_val: float, streak: int) -> str:
    today = datetime.utcnow().strftime("%A, %d %B %Y")
    sig_rows = ""
    for s in signals[:5]:
        icon   = SIGNAL_ICONS.get(s.get("signal_type", ""), "⚡")
        color  = STRENGTH_COLOR.get(s.get("signal_strength", "medium"), "#f5a623")
        sig_rows += f"""
        <tr>
          <td style="padding:12px 8px;border-bottom:1px solid #2a2a2a;">
            <span style="font-size:20px">{icon}</span>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #2a2a2a;">
            <div style="color:#fff;font-weight:600;font-size:14px">{s.get("account_name","")}</div>
            <div style="color:#aaa;font-size:13px;margin-top:2px">{s.get("title","")}</div>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #2a2a2a;text-align:right">
            <span style="background:{color};color:#fff;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:700">
              {s.get("signal_strength","").upper()}
            </span>
            <div style="color:#aaa;font-size:12px;margin-top:4px">Score: {s.get("score",0)}/10</div>
          </td>
        </tr>"""

    action_items = ""
    for i, s in enumerate(signals[:3], 1):
        action_items += f"""
        <div style="background:#1a1a1a;border-left:3px solid #E50914;padding:12px 16px;margin-bottom:10px;border-radius:0 6px 6px 0">
          <div style="color:#E50914;font-size:12px;font-weight:700;margin-bottom:4px">ACTION {i}</div>
          <div style="color:#fff;font-size:14px">{s.get("account_name","")} — {s.get("recommended_action","")}</div>
        </div>"""

    streak_bar = "🔥" * min(streak, 7) if streak > 0 else "Start your streak today!"

    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#E50914 0%,#b30000 100%);padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <div style="color:#fff;font-size:22px;font-weight:800">⚡ Signal CRM</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">Your daily intelligence brief — {today}</div>
    </div>

    <!-- Greeting -->
    <div style="background:#141414;padding:20px 24px;border:1px solid #222">
      <div style="color:#fff;font-size:18px;font-weight:700">Good morning, {user_name.split()[0]} 👋</div>
      <div style="color:#aaa;font-size:14px;margin-top:6px">
        You have <strong style="color:#E50914">{len(signals)} signals</strong> to act on.
        Pipeline: <strong style="color:#46d369">₹{pipeline_val:,.0f}</strong> across {deals_active} active deals.
      </div>
    </div>

    <!-- Streak -->
    <div style="background:#1a1a1a;padding:14px 24px;border:1px solid #222;border-top:none;display:flex;align-items:center;gap:12px">
      <div style="color:#f5a623;font-size:20px">{streak_bar}</div>
      <div style="color:#aaa;font-size:13px">{streak}-day action streak — keep going!</div>
    </div>

    <!-- Top Signals -->
    <div style="background:#141414;padding:20px 24px;border:1px solid #222;border-top:none">
      <div style="color:#fff;font-size:16px;font-weight:700;margin-bottom:16px">🎯 Top Signals This Morning</div>
      <table style="width:100%;border-collapse:collapse">
        {sig_rows}
      </table>
    </div>

    <!-- Today's 3 Actions -->
    <div style="background:#141414;padding:20px 24px;border:1px solid #222;border-top:none">
      <div style="color:#fff;font-size:16px;font-weight:700;margin-bottom:14px">📋 Your 3 Actions for Today</div>
      {action_items}
    </div>

    <!-- CTA -->
    <div style="background:#141414;padding:20px 24px;border:1px solid #222;border-top:none;text-align:center;border-radius:0 0 12px 12px">
      <a href="{APP_URL}/dashboard"
         style="display:inline-block;background:#E50914;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">
        Open Dashboard →
      </a>
      <div style="color:#555;font-size:12px;margin-top:16px">
        Signal CRM by Nanoneuron Services ·
        <a href="{APP_URL}/dashboard" style="color:#555">Unsubscribe</a>
      </div>
    </div>

  </div>
</body></html>"""


def _alert_html(user_name: str, signal: dict) -> str:
    icon   = SIGNAL_ICONS.get(signal.get("signal_type", ""), "⚡")
    color  = STRENGTH_COLOR.get(signal.get("signal_strength", "high"), "#E50914")
    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:20px;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:0 auto">
    <div style="background:#E50914;padding:16px 20px;border-radius:8px 8px 0 0;text-align:center">
      <div style="color:#fff;font-weight:800;font-size:16px">🚨 HIGH-PRIORITY SIGNAL DETECTED</div>
    </div>
    <div style="background:#141414;border:1px solid #E50914;padding:20px;border-radius:0 0 8px 8px">
      <div style="font-size:28px;margin-bottom:8px">{icon}</div>
      <div style="color:#E50914;font-weight:700;font-size:12px;margin-bottom:4px">{signal.get("signal_type","").replace("_"," ").upper()}</div>
      <div style="color:#fff;font-size:18px;font-weight:700;margin-bottom:8px">{signal.get("title","")}</div>
      <div style="color:#aaa;font-size:14px;margin-bottom:16px">{signal.get("summary","")}</div>
      <div style="background:#1a1a1a;border-left:3px solid #E50914;padding:12px;margin-bottom:16px">
        <div style="color:#E50914;font-size:12px;font-weight:700">RECOMMENDED ACTION</div>
        <div style="color:#fff;font-size:14px;margin-top:4px">{signal.get("recommended_action","")}</div>
      </div>
      <a href="{APP_URL}/dashboard/signals?id={signal.get('id','')}"
         style="display:block;background:#E50914;color:#fff;padding:12px;border-radius:6px;text-decoration:none;font-weight:700;text-align:center">
        View Full Analysis →
      </a>
    </div>
  </div>
</body></html>"""


async def send_daily_digest(user_email: str, user_name: str, signals: list,
                            deals_active: int, pipeline_val: float, streak: int) -> bool:
    today = datetime.utcnow().strftime("%d %b")
    subject = f"⚡ {len(signals)} signals waiting — {today} | Signal CRM"
    html    = _digest_html(user_name, signals, deals_active, pipeline_val, streak)
    return await asyncio.to_thread(_send_smtp, user_email, subject, html)


async def send_signal_alert(user_email: str, user_name: str, signal: dict) -> bool:
    company = signal.get("account_name", "Company")
    subject = f"🚨 HIGH SIGNAL: {company} — {signal.get('title','')[:50]}"
    html    = _alert_html(user_name, signal)
    return await asyncio.to_thread(_send_smtp, user_email, subject, html)
