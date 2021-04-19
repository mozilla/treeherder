from datetime import datetime, timedelta
from json import JSONDecodeError
from unittest.mock import MagicMock

import pytest
from django.db import models

from tests.perf.auto_perf_sheriffing.conftest import prepare_record_with_search_str
from treeherder.model.models import Job, Push
from treeherder.perf.auto_perf_sheriffing.sherlock import Sherlock
from treeherder.perf.email import BackfillNotificationWriter
from treeherder.perf.exceptions import MaxRuntimeExceeded
from treeherder.perf.models import BackfillRecord, BackfillReport

EPOCH = datetime.utcfromtimestamp(0)


def has_changed(orm_object: models.Model) -> bool:
    """
    Checks if the ORM object's underlying table row
    has changed since last database sync.
    """
    db_obj = orm_object.__class__.objects.get(pk=orm_object.pk)
    for f in orm_object._meta.local_fields:
        if orm_object.__getattribute__(f.name) != db_obj.__getattribute__(f.name):
            return True
    return False


class TestEmailIntegration:
    def test_email_is_sent_after_successful_backfills(
        self,
        report_maintainer_mock,
        backfill_tool_mock,
        secretary,
        record_ready_for_processing,
        sherlock_settings,
        notify_client_mock,
    ):

        sherlock = Sherlock(
            report_maintainer_mock,
            backfill_tool_mock,
            secretary,
            notify_client_mock,
            email_writer=self.email_writer_mock(),
        )
        sherlock.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])
        record_ready_for_processing.refresh_from_db()

        assert notify_client_mock.email.call_count == 1

    def test_email_is_still_sent_if_context_is_too_corrupt_to_be_actionable(
        self,
        report_maintainer_mock,
        backfill_tool_mock,
        secretary,
        record_ready_for_processing,
        sherlock_settings,
        notify_client_mock,
        broken_context_str,
        # Note: parametrizes the test
    ):
        record_ready_for_processing.context = broken_context_str
        record_ready_for_processing.save()

        sherlock = Sherlock(
            report_maintainer_mock,
            backfill_tool_mock,
            secretary,
            notify_client_mock,
        )
        sherlock.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])

        assert notify_client_mock.email.call_count == 1

    def test_no_email_is_sent_if_runtime_exceeded(
        self,
        report_maintainer_mock,
        backfill_tool_mock,
        secretary,
        record_ready_for_processing,
        sherlock_settings,
        notify_client_mock,
    ):
        no_time_left = timedelta(seconds=0)

        sherlock = Sherlock(
            report_maintainer_mock, backfill_tool_mock, secretary, notify_client_mock, no_time_left
        )
        try:
            sherlock.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])
        except MaxRuntimeExceeded:
            pass

        assert notify_client_mock.email.call_count == 0

    @staticmethod
    def email_writer_mock():
        return MagicMock(spec=BackfillNotificationWriter())


def test_record_job_symbol_is_none_if_component_misses(record_with_missing_job_symbol_components):
    job_symbol = record_with_missing_job_symbol_components.job_symbol

    # testing with each component missing
    assert job_symbol is None


def test_record_correct_job_symbol(record_with_job_symbol):
    expected_job_symbol = 'Btime[tier 2](Bogo)'
    assert record_with_job_symbol.job_symbol == expected_job_symbol


@pytest.mark.parametrize(
    'search_str_with, expected_search_str',
    [
        ('all_fields', 'win7,Browsertime performance tests on Firefox,Bogo tests,Bogo'),
        ('no_job_group', 'win7,Bogo tests,Bogo'),
        ('no_job_type', 'win7,Browsertime performance tests on Firefox'),
    ],
)
def test_record_search_str(record_with_job_symbol, search_str_with, expected_search_str):
    record = prepare_record_with_search_str(record_with_job_symbol, search_str_with)
    search_str = record.get_job_search_str()

    assert search_str == expected_search_str


def test_records_change_to_ready_for_processing(
    test_perf_alert,
    create_record,
    record_from_mature_report,
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    sherlock_settings,
    notify_client_mock,
):
    # create new report with records - the report will not be mature
    create_record(test_perf_alert)

    preliminary_records = BackfillRecord.objects.filter(status=BackfillRecord.PRELIMINARY)
    ready_records = BackfillRecord.objects.filter(status=BackfillRecord.READY_FOR_PROCESSING)
    frozen_reports = BackfillReport.objects.filter(frozen=True)
    assert preliminary_records.count() == 2
    assert ready_records.count() == 0
    assert frozen_reports.count() == 0

    sherlock = Sherlock(
        report_maintainer_mock,
        backfill_tool_mock,
        secretary,
        notify_client_mock,
    )
    sherlock.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])

    assert preliminary_records.count() == 1
    assert ready_records.count() == 1
    assert frozen_reports.count() == 1


def test_assert_can_run_throws_exception_when_runtime_exceeded(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    notify_client_mock,
):
    no_time_left = timedelta(seconds=0)
    sherlock_bot = Sherlock(
        report_maintainer_mock, backfill_tool_mock, secretary, notify_client_mock, no_time_left
    )

    with pytest.raises(MaxRuntimeExceeded):
        sherlock_bot.assert_can_run()


def test_assert_can_run_doesnt_throw_exception_when_enough_time_left(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    notify_client_mock,
    record_ready_for_processing,
    sherlock_settings,
):
    enough_time_left = timedelta(minutes=10)
    sherlock = Sherlock(
        report_maintainer_mock, backfill_tool_mock, secretary, notify_client_mock, enough_time_left
    )

    try:
        sherlock.assert_can_run()
    except MaxRuntimeExceeded:
        pytest.fail()


def test_records_and_db_limits_remain_unchanged_if_no_records_suitable_for_backfill(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    notify_client_mock,
    sherlock_settings,
    record_unsuited_for_backfill,
):
    sherlock = Sherlock(report_maintainer_mock, backfill_tool_mock, secretary, notify_client_mock)
    sherlock._backfill()

    assert not has_changed(record_unsuited_for_backfill)
    assert not has_changed(sherlock_settings)


def test_records_remain_unchanged_if_no_backfills_left(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    notify_client_mock,
    record_ready_for_processing,
    empty_sheriff_settings,
):
    sherlock = Sherlock(report_maintainer_mock, backfill_tool_mock, secretary, notify_client_mock)
    sherlock._backfill()

    assert not has_changed(record_ready_for_processing)


def test_records_and_db_limits_remain_unchanged_if_runtime_exceeded(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    notify_client_mock,
):
    no_time_left = timedelta(seconds=0)
    sherlock = Sherlock(
        report_maintainer_mock, backfill_tool_mock, secretary, notify_client_mock, no_time_left
    )
    try:
        sherlock.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])
    except MaxRuntimeExceeded:
        pass

    assert not has_changed(record_ready_for_processing)
    assert not has_changed(sherlock_settings)


def test_db_limits_update_if_backfills_left(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    notify_client_mock,
):
    targeted_platform = record_ready_for_processing.platform.platform

    initial_backfills = secretary.backfills_left(on_platform=targeted_platform)
    sherlock = Sherlock(report_maintainer_mock, backfill_tool_mock, secretary, notify_client_mock)
    sherlock.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])

    record_ready_for_processing.refresh_from_db()
    assert record_ready_for_processing.status == BackfillRecord.BACKFILLED
    assert (initial_backfills - 4) == secretary.backfills_left(on_platform=targeted_platform)


def test_backfilling_gracefully_handles_invalid_json_contexts_without_blowing_up(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sherlock_settings,
    notify_client_mock,
    broken_context_str,  # Note: parametrizes the test
):
    record_ready_for_processing.context = broken_context_str
    record_ready_for_processing.save()

    sherlock = Sherlock(report_maintainer_mock, backfill_tool_mock, secretary, notify_client_mock)
    try:
        sherlock.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])
    except (JSONDecodeError, KeyError, Job.DoesNotExist, Push.DoesNotExist):
        pytest.fail()

    record_ready_for_processing.refresh_from_db()

    assert record_ready_for_processing.status == BackfillRecord.FAILED
    assert not has_changed(sherlock_settings)
