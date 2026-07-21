import datetime

from treeherder.perf.models import PerformanceAlertSummary


def test_bug_status_resets_on_bug_number_change(
    test_repository, push_stored, test_perf_framework, test_issue_tracker
):
    summary = PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.datetime.now(),
        bug_number=12345,
    )
    summary.bug_status = PerformanceAlertSummary.BUG_FIXED
    summary.save()

    summary.bug_number = 54321
    summary.save()
    summary.refresh_from_db()
    assert summary.bug_status is None


def test_bug_status_unchanged_when_bug_number_not_changed(
    test_repository, push_stored, test_perf_framework, test_issue_tracker
):
    summary = PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.datetime.now(),
        bug_number=12345,
    )
    summary.bug_status = PerformanceAlertSummary.BUG_FIXED
    summary.save()
    summary.refresh_from_db()
    assert summary.bug_status == PerformanceAlertSummary.BUG_FIXED
