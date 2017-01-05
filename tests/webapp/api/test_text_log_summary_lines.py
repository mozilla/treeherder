from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.model.models import (BugJobMap,
                                     FailureLine,
                                     JobNote,
                                     TextLogSummary)


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


def test_put_verify_job(webapp, test_repository, test_job, text_summary_lines, test_user,
                        failure_classifications):
    client = APIClient()
    client.force_authenticate(user=test_user)

    FailureLine.objects.filter(job_guid=test_job.guid).update(best_is_verified=True)

    text_summary_lines = TextLogSummary.objects.filter(job_guid=test_job.guid).get().lines.all()
    assert len(text_summary_lines) > 0
    data = [{"id": item.id, "bug_number": i + 1, "verified": True} for
            i, item in enumerate(text_summary_lines)]

    resp = client.put(reverse("text-log-summary-line-list"),
                      data, format="json")

    assert resp.status_code == 200

    assert test_job.is_fully_verified()

    bug_job_items = BugJobMap.objects.filter(job=test_job)
    assert {item.bug_id for item in bug_job_items} == set(range(1, len(text_summary_lines) + 1))
    assert all(item.user == test_user for item in bug_job_items)

    note = JobNote.objects.filter(job=test_job).get()
    assert note.user == test_user
    assert note.failure_classification.name == "intermittent"
