"""Resend email integration — fires a notification when a new lead is captured."""
import os
import html
import re
import asyncio
import logging
import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
LEAD_NOTIFICATION_EMAIL = os.environ.get("LEAD_NOTIFICATION_EMAIL", "")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _format_lead_html(lead: dict) -> str:
    # Every value here is typed by an anonymous visitor. Escape all of it —
    # otherwise anyone can inject links or fake content into an email that
    # arrives in your inbox wearing your own branding.
    safe = {
        k: (html.escape(str(v), quote=True) if v not in (None, "") else "—")
        for k, v in lead.items()
        if not isinstance(v, (list, dict))
    }
    for key in ("source", "name", "email", "phone", "company", "service_interest", "message"):
        safe.setdefault(key, "—")
    return f"""\
<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;background:#f1f5f9;padding:24px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;">
      <tr><td style="background:#0D1321;color:#ffffff;padding:24px;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#C8A06A;text-transform:uppercase;">Synferrous</div>
        <div style="font-size:22px;font-weight:700;margin-top:6px;">New lead captured 🎯</div>
      </td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5;">A prospect just submitted a form on synferrous.com. Source: <strong>{safe['source']}</strong>.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#475569;width:140px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#020617;font-weight:600;">{safe['name']}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#475569;">Email</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#020617;"><a href="mailto:{safe['email']}" style="color:#0D1321;">{safe['email']}</a></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#475569;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#020617;">{safe['phone']}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#475569;">Company</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#020617;">{safe['company']}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#475569;">Service interest</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#020617;">{safe['service_interest']}</td></tr>
          <tr><td style="padding:10px 0;color:#475569;vertical-align:top;">Message</td><td style="padding:10px 0;color:#020617;line-height:1.6;white-space:pre-wrap;">{safe['message']}</td></tr>
        </table>
        <div style="margin-top:24px;">
          <a href="{os.environ.get('SITE_URL','')}/admin/leads" style="display:inline-block;background:#C8A06A;color:#0D1321;padding:12px 20px;font-weight:600;text-decoration:none;">Open in Admin →</a>
        </div>
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;font-family:'Courier New',monospace;">Synferrous · Delhi NCR, India</td></tr>
    </table>
  </td></tr>
</table>"""


async def send_lead_notification(lead: dict) -> bool:
    """Non-blocking. Returns True if email accepted by Resend, False otherwise."""
    if not RESEND_API_KEY or not LEAD_NOTIFICATION_EMAIL:
        logger.warning("Resend not configured — lead notification skipped")
        return False
    params = {
        "from": SENDER_EMAIL,
        "to": [LEAD_NOTIFICATION_EMAIL],
        # Collapse whitespace/newlines in visitor-supplied text before it goes
        # into a header field.
        "subject": re.sub(r"\s+", " ", f"New lead — {lead.get('name', 'Unknown')} ({lead.get('source', '')})")[:150],
        "html": _format_lead_html(lead),
        "reply_to": lead.get("email") or SENDER_EMAIL,
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info("Lead notification sent: %s", result.get("id"))
        return True
    except Exception as exc:
        logger.exception("Failed to send lead notification: %s", exc)
        return False


# ── Diagnostics (Admin → Site settings) ─────────────────────────────────────
def status() -> dict:
    """What's configured, without ever revealing a secret's value."""
    sender = SENDER_EMAIL or ""
    using_test_sender = sender.endswith("@resend.dev")
    problems = []
    if not RESEND_API_KEY:
        problems.append("RESEND_API_KEY is not set on Render, so no lead alerts are sent.")
    if not LEAD_NOTIFICATION_EMAIL:
        problems.append("LEAD_NOTIFICATION_EMAIL is not set on Render — there's nowhere to send alerts.")
    if using_test_sender:
        problems.append(
            "Sending from Resend's test address (onboarding@resend.dev): Resend only delivers it to the "
            "email your Resend account is registered with. Make sure that matches LEAD_NOTIFICATION_EMAIL, "
            "or verify synferrous.com in Resend."
        )
    return {
        "resend_key_set": bool(RESEND_API_KEY),
        "recipient": LEAD_NOTIFICATION_EMAIL or None,
        "sender": sender,
        "using_test_sender": using_test_sender,
        "ready": bool(RESEND_API_KEY and LEAD_NOTIFICATION_EMAIL),
        "notes": problems,
    }


async def send_test_email() -> tuple[bool, str]:
    """Send a real test alert and report exactly what Resend said."""
    s = status()
    if not s["ready"]:
        return False, " ".join(n for n in s["notes"] if "not set" in n)
    params = {
        "from": SENDER_EMAIL,
        "to": [LEAD_NOTIFICATION_EMAIL],
        "subject": "Synferrous — test lead alert",
        "html": "<p>This is a test from Admin → Site settings. If you can read this, "
                "lead alerts are working.</p>",
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return True, (f"Sent to {LEAD_NOTIFICATION_EMAIL} (Resend id {result.get('id')}). "
                      "If it isn't in your inbox within a minute, check Spam and Promotions.")
    except Exception as exc:  # noqa: BLE001 — surface Resend's own message
        msg = str(exc) or exc.__class__.__name__
        hint = ""
        low = msg.lower()
        if "own email" in low or "testing emails" in low:
            hint = (" → Resend's test sender can only email your Resend account's address. Either sign up "
                    "to Resend with the address in LEAD_NOTIFICATION_EMAIL, or verify synferrous.com in Resend.")
        elif "not verified" in low or "domain" in low:
            hint = " → Verify synferrous.com in Resend, or set SENDER_EMAIL=onboarding@resend.dev for now."
        elif "api key" in low or "unauthorized" in low or "401" in low:
            hint = " → RESEND_API_KEY on Render is wrong or revoked — create a new key in Resend."
        return False, f"Resend refused it: {msg[:300]}{hint}"
