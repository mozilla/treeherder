import json

from django.urls import reverse


def test_valid_report(client):
    """Tests that a correctly formed CSP violation report is accepted when unauthenticated."""
    valid_report = {
        "csp-report": {
            # The Content Security Policy report is a dictionary as documented at
            # https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#violation_report_syntax
            # The app only forwards the browser-generate CSP report to the
            # endpoint for the reports.
        }
    }
    response = client.post(
        reverse("csp-report"),
        data=json.dumps(valid_report),
        content_type="application/csp-report",
    )
    assert response.status_code == 200


def test_invalid_report(client):
    """Test that badly formed reports are gracefully handled."""
    invalid_report = "bad"
    response = client.post(
        reverse("csp-report"),
        data=json.dumps(invalid_report),
        content_type="application/csp-report",
    )
    assert response.status_code == 400
