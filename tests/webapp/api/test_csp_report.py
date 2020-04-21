import json

from django.urls import reverse


def test_valid_report(client):
    """Tests that a correctly formed CSP violation report is accepted when unauthenticated."""
    valid_report = {
        'csp-report': {
            'blocked-uri': 'https://treestatus.mozilla-releng.net/trees/mozilla-inbound',
            'document-uri': 'http://localhost:8000/',
            'original-policy': '...',
            'referrer': '',
            'violated-directive': 'connect-src',
        }
    }
    response = client.post(
        reverse('csp-report'), data=json.dumps(valid_report), content_type='application/csp-report',
    )
    assert response.status_code == 200


def test_invalid_report(client):
    """Test that badly formed reports are gracefully handled."""
    invalid_report = 'bad'
    response = client.post(
        reverse('csp-report'),
        data=json.dumps(invalid_report),
        content_type='application/csp-report',
    )
    assert response.status_code == 400
