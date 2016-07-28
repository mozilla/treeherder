import pytest
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

pytestmark = pytest.mark.skip(reason='Maintenance mode')


def test_get_summary_line(webapp, text_summary_lines):
    """
    test getting a single failure line
    """
    summary_lines = text_summary_lines
    summary_lines[0].bug_number = 1234
    summary_lines[0].save()

    resp = webapp.get(
        reverse("text-log-summary-line-detail", kwargs={"pk": summary_lines[0].id}))

    assert resp.status_int == 200
    actual = resp.json
    expected = {"id": summary_lines[0].id,
                "summary": summary_lines[0].summary.id,
                "line_number": summary_lines[0].line_number,
                "failure_line": summary_lines[0].failure_line.id,
                "bug_number": 1234,
                "verified": False,
                "bug": None}

    assert actual == expected


def test_get_text_summary_lines(webapp, text_summary_lines):
    text_summary_lines[0].bug_number = 1234
    text_summary_lines[0].save()

    resp = webapp.get(reverse("text-log-summary-line-list"))
    assert resp.status_int == 200

    actual = resp.json
    expected = {"next": None,
                "previous": None,
                "results": [{"id": line.id,
                             "summary": line.summary.id,
                             "line_number": line.line_number,
                             "failure_line": line.failure_line.id,
                             "bug_number": line.bug_number,
                             "verified": False,
                             "bug": None} for line in reversed(text_summary_lines)]}
    assert actual == expected


def test_put_bug_number(webapp, text_summary_lines, test_user):
    client = APIClient()
    client.force_authenticate(user=test_user)

    text_summary_lines[0].bug_number = 1234
    text_summary_lines[0].save()

    resp = client.put(reverse("text-log-summary-line-detail",
                              kwargs={"pk": text_summary_lines[0].id}),
                      {"bug_number": 5678,
                       "verified": True}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": text_summary_lines[0].id,
                "summary": text_summary_lines[0].summary.id,
                "line_number": text_summary_lines[0].line_number,
                "failure_line": text_summary_lines[0].failure_line.id,
                "bug_number": 5678,
                "verified": True,
                "bug": None}
    assert actual == expected

    text_summary_lines[0].refresh_from_db()
    assert text_summary_lines[0].bug_number == 5678


def test_put_multiple(webapp, text_summary_lines, test_user):
    client = APIClient()
    client.force_authenticate(user=test_user)

    text_summary_lines[0].bug_number = 1234
    text_summary_lines[0].save()

    resp = client.put(reverse("text-log-summary-line-list"),
                      [{"id": text_summary_lines[0].id, "bug_number": 5678, "verified": True},
                       {"id": text_summary_lines[1].id, "bug_number": 9012, "verified": True}],
                      format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = [{"id": text_summary_lines[0].id,
                 "summary": text_summary_lines[0].summary.id,
                 "line_number": text_summary_lines[0].line_number,
                 "failure_line": text_summary_lines[0].failure_line.id,
                 "bug_number": 5678,
                 "verified": True,
                 "bug": None},
                {"id": text_summary_lines[1].id,
                 "summary": text_summary_lines[1].summary.id,
                 "line_number": text_summary_lines[1].line_number,
                 "failure_line": text_summary_lines[1].failure_line.id,
                 "bug_number": 9012,
                 "verified": True,
                 "bug": None}]
    assert actual == expected

    text_summary_lines[0].refresh_from_db()
    assert text_summary_lines[0].bug_number == 5678
    text_summary_lines[1].refresh_from_db()
    assert text_summary_lines[1].bug_number == 9012


def test_put_multiple_duplicate(webapp, text_summary_lines, test_user):
    client = APIClient()
    client.force_authenticate(user=test_user)

    text_summary_lines[0].bug_number = 1234
    text_summary_lines[0].save()

    resp = client.put(reverse("text-log-summary-line-list"),
                      [{"id": text_summary_lines[0].id, "bug_number": 5678, "verified": True},
                       {"id": text_summary_lines[0].id, "bug_number": 9012, "verified": True}],
                      format="json")

    assert resp.status_code == 400
