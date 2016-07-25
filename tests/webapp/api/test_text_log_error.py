from django.core.urlresolvers import reverse
from rest_framework.test import APIClient


def test_get_textlog_error(webapp, textlog_errors):
    """
    test getting a single textlog error
    """
    textlog_errors[0].bug_number = 1234
    textlog_errors[0].save()

    resp = webapp.get(
        reverse("text-log-error-detail", kwargs={"pk": textlog_errors[0].id}))

    assert resp.status_int == 200
    actual = resp.json
    expected = {"id": textlog_errors[0].id,
                "line": textlog_errors[0].line,
                "line_number": textlog_errors[0].line_number,
                "failure_line": textlog_errors[0].failure_line.id,
                "bug_number": 1234,
                "verified": False}

    assert actual == expected


def test_get_textlog_errors(webapp, textlog_errors):
    textlog_errors[0].bug_number = 1234
    textlog_errors[0].save()

    resp = webapp.get(reverse("text-log-summary-line-list"))
    assert resp.status_int == 200

    actual = resp.json
    expected = {"next": None,
                "previous": None,
                "results": [{"id": error.id,
                             "line": error.summary.id,
                             "line_number": error.line_number,
                             "failure_line": error.failure_line.id,
                             "bug_number": error.bug_number,
                             "verified": False,
                             "bug": None} for error in reversed(textlog_errors)]}
    assert actual == expected


def test_put_bug_number(webapp, textlog_errors, test_user):
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


def test_put_multiple(webapp, textlog_errors, test_user):
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


def test_put_multiple_duplicate(webapp, textlog_errors, test_user):
    client = APIClient()
    client.force_authenticate(user=test_user)

    text_summary_lines[0].bug_number = 1234
    text_summary_lines[0].save()

    resp = client.put(reverse("text-log-summary-line-list"),
                      [{"id": text_summary_lines[0].id, "bug_number": 5678, "verified": True},
                       {"id": text_summary_lines[0].id, "bug_number": 9012, "verified": True}],
                      format="json")

    assert resp.status_code == 400
