"""Public lead endpoint: consent, spam scoring and rate limiting."""
import time


def lead(**overrides):
    body = {
        "name": "Real Person", "email": "real@example.com", "message": "We need help scoping an AI pilot.",
        "consent": True, "consent_text": "I agree…",
        # Rendered 10 seconds ago — a plausible human fill time.
        "form_started_at": int((time.time() - 10) * 1000),
    }
    body.update(overrides)
    return body


def stored(client, admin):
    return client.get("/api/admin/leads", headers=admin).json()


def test_consent_is_required(client):
    r = client.post("/api/leads", json=lead(consent=False))
    assert r.status_code == 400


def test_genuine_lead_is_stored_with_a_consent_record_and_emailed(client, admin):
    assert client.post("/api/leads", json=lead()).status_code == 200
    [l] = stored(client, admin)
    assert l["status"] == "new"
    assert l["consent"] is True and l["consent_at"] and l["consent_text"] == "I agree…"
    assert len(client.sent_emails) == 1


def test_response_echoes_no_personal_data(client):
    body = client.post("/api/leads", json=lead()).json()
    assert set(body) == {"ok", "id"}


def test_honeypot_marks_spam_and_suppresses_the_email(client, admin):
    r = client.post("/api/leads", json=lead(website="http://spam.example"))
    assert r.status_code == 200  # a bot learns nothing from the response
    [l] = stored(client, admin)
    assert l["status"] == "spam"
    assert "honeypot field filled" in l["spam_reasons"]
    assert client.sent_emails == []


def test_instant_submission_is_spam(client, admin):
    client.post("/api/leads", json=lead(form_started_at=int(time.time() * 1000)))
    assert stored(client, admin)[0]["status"] == "spam"


def test_honeypot_fields_are_not_persisted(client, admin):
    client.post("/api/leads", json=lead())
    [l] = stored(client, admin)
    assert "website" not in l and "form_started_at" not in l


def test_spam_is_excluded_from_lead_reports(client, admin):
    client.post("/api/leads", json=lead())
    client.post("/api/leads", json=lead(email="bot@example.com", website="x"))
    rep = client.get("/api/admin/reports/leads?days=30", headers=admin).json()
    assert rep["total"] == 1
    assert rep["spam_blocked"] == 1


def test_lead_form_is_rate_limited_per_ip(client):
    codes = [client.post("/api/leads", json=lead(email=f"r{i}@example.com")).status_code
             for i in range(6)]
    assert codes[:5] == [200] * 5
    assert codes[5] == 429


def test_lead_email_escapes_visitor_html():
    """Regression: visitor input was interpolated raw into the HTML email."""
    from email_service import _format_lead_html
    html = _format_lead_html({
        "source": "x", "name": '<a href="https://evil">Verify</a>', "email": "a@b.c",
        "message": "<script>alert(1)</script>",
    })
    assert "<script>" not in html
    assert 'href="https://evil"' not in html
    assert "&lt;script&gt;" in html
