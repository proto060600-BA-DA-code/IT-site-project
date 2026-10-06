"""Admin integrations panel: explains what's configured, never leaks secrets,
and surfaces Resend's real error instead of failing silently."""
import json

import email_service


def test_status_never_reveals_secret_values(client, admin, monkeypatch):
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "re_supersecret_123")
    monkeypatch.setattr(email_service, "LEAD_NOTIFICATION_EMAIL", "me@example.com")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-secret-456")
    body = client.get("/api/admin/settings/integrations", headers=admin).json()
    blob = json.dumps(body)
    assert "re_supersecret_123" not in blob and "sk-ant-secret-456" not in blob
    assert body["lead_alerts"]["resend_key_set"] is True
    assert body["chat"]["ready"] is True


def test_unconfigured_alerts_are_explained(client, admin, monkeypatch):
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "")
    monkeypatch.setattr(email_service, "LEAD_NOTIFICATION_EMAIL", "")
    la = client.get("/api/admin/settings/integrations", headers=admin).json()["lead_alerts"]
    assert la["ready"] is False
    assert any("RESEND_API_KEY" in n for n in la["notes"])
    r = client.post("/api/admin/settings/test-email", headers=admin).json()
    assert r["ok"] is False and "RESEND_API_KEY" in r["detail"]


def test_test_email_reports_success(client, admin, monkeypatch):
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "re_x")
    monkeypatch.setattr(email_service, "LEAD_NOTIFICATION_EMAIL", "me@example.com")
    sent = {}
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda p: sent.update(p) or {"id": "abc123"})
    r = client.post("/api/admin/settings/test-email", headers=admin).json()
    assert r["ok"] is True and "abc123" in r["detail"]
    assert sent["to"] == ["me@example.com"]


def test_resend_test_sender_restriction_is_explained(client, admin, monkeypatch):
    """The most common failure: onboarding@resend.dev to a non-account address."""
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "re_x")
    monkeypatch.setattr(email_service, "LEAD_NOTIFICATION_EMAIL", "someone@gmail.com")

    def refuse(_):
        raise Exception("You can only send testing emails to your own email address (owner@x.com).")
    monkeypatch.setattr(email_service.resend.Emails, "send", refuse)

    r = client.post("/api/admin/settings/test-email", headers=admin).json()
    assert r["ok"] is False
    assert "own email" in r["detail"]
    assert "verify synferrous.com" in r["detail"]


def test_viewer_cannot_send_test_emails(client, viewer):
    assert client.post("/api/admin/settings/test-email", headers=viewer).status_code == 403
