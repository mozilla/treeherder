from datetime import datetime, timedelta

import pytest
from django.core.management import call_command

from tests import settings as test_settings
from treeherder.perf.auto_perf_sheriffing.sherlock import Sherlock
from treeherder.perf.exceptions import MaxRuntimeExceededError
from treeherder.perf.models import BackfillNotificationRecord, BackfillRecord

EPOCH = datetime.utcfromtimestamp(0)


# TODO: Update tests so that the mock 'tc_notify_mock' works as expected
def test_email_is_sent_after_successful_backfills(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    tc_notify_mock,
):
    sherlock = Sherlock(
        report_maintainer_mock,
        backfill_tool_mock,
        secretary,
    )
    sherlock.sheriff(
        since=EPOCH,
        frameworks=["test_talos"],
        repositories=[test_settings.TREEHERDER_TEST_REPOSITORY_NAME],
    )
    record_ready_for_processing.refresh_from_db()
    assert BackfillNotificationRecord.objects.count() == 1
    call_command("report_backfill_outcome")
    assert BackfillNotificationRecord.objects.count() == 0


def test_email_is_still_sent_if_backfill_job_is_missing(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    tc_notify_mock,
):
    # Simulate a job that has expired/been deleted: datum exists at anchor_push_id but job=None.
    # The backfill is skipped (no valid job_id), record ends up FAILED,
    # but the notification must still be sent.
    from treeherder.perf.models import PerformanceDatum

    PerformanceDatum.objects.filter(
        signature=record_ready_for_processing.alert.series_signature,
        push_id=record_ready_for_processing.anchor_push_id,
    ).update(job=None)

    sherlock = Sherlock(
        report_maintainer_mock,
        backfill_tool_mock,
        secretary,
    )
    sherlock.sheriff(
        since=EPOCH,
        frameworks=["test_talos"],
        repositories=[test_settings.TREEHERDER_TEST_REPOSITORY_NAME],
    )

    record_ready_for_processing.refresh_from_db()
    assert record_ready_for_processing.status == BackfillRecord.FAILED
    assert BackfillNotificationRecord.objects.count() == 1
    call_command("report_backfill_outcome")
    assert BackfillNotificationRecord.objects.count() == 0


def test_no_email_is_sent_if_runtime_exceeded(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    tc_notify_mock,
):
    no_time_left = timedelta(seconds=0)

    sherlock = Sherlock(report_maintainer_mock, backfill_tool_mock, secretary, no_time_left)
    try:
        sherlock.sheriff(since=EPOCH, frameworks=["raptor", "talos"], repositories=["autoland"])
    except MaxRuntimeExceededError:
        pass

    assert BackfillNotificationRecord.objects.count() == 0
    call_command("report_backfill_outcome")
    assert BackfillNotificationRecord.objects.count() == 0


@pytest.mark.parametrize(
    "framework, repository",
    [
        ("non_existent_framework", test_settings.TREEHERDER_TEST_REPOSITORY_NAME),
        ("test_talos", "non_existent_repository"),
        ("non_existent_framework", "non_existent_repository"),
    ],
)
def test_no_email_is_sent_for_untargeted_alerts(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    framework,
    repository,
    tc_notify_mock,
):
    sherlock = Sherlock(
        report_maintainer_mock,
        backfill_tool_mock,
        secretary,
    )
    sherlock.sheriff(
        since=EPOCH,
        frameworks=[framework],
        repositories=[repository],
    )
    record_ready_for_processing.refresh_from_db()

    assert BackfillNotificationRecord.objects.count() == 0
    call_command("report_backfill_outcome")
    assert BackfillNotificationRecord.objects.count() == 0
