import json
from copy import copy, deepcopy
from datetime import datetime, timedelta
from json import JSONDecodeError

import pytest

from django.db import models

from treeherder.model.models import Job
from treeherder.perf.exceptions import MaxRuntimeExceeded
from treeherder.perf.models import BackfillRecord, BackfillReport, PerformanceSettings
from treeherder.perf.perf_sheriff_bot import PerfSheriffBot
from treeherder.perf.secretary_tool import SecretaryTool

from tests.conftest import SampleDataJSONLoader

load_json_fixture = SampleDataJSONLoader('perf_sheriff_bot')

EPOCH = datetime.utcfromtimestamp(0)

# TODO: remove when features enabled
FEATURE_FLAGS = {
    'backfill_tool_disabled': False,
    'secretary_tool_disabled': False,
}
# -> up to here


@pytest.fixture(scope="module")
def record_context_sample():
    # contains 5 data points that can be backfilled
    return load_json_fixture('recordContext.json')


@pytest.fixture(params=['totally_broken_json', 'missing_job_fields', 'null_job_fields'])
def broken_context_str(record_context_sample: dict, request) -> list:
    context_str = json.dumps(record_context_sample)
    specific = request.param

    if specific == 'totally_broken_json':
        return copy(context_str).replace(r'"', '<')

    else:
        record_copy = deepcopy(record_context_sample)
        if specific == 'missing_job_fields':
            for data_point in record_copy:
                del data_point['job_id']

        elif specific == 'null_job_fields':
            for data_point in record_copy:
                data_point['job_id'] = None
        return json.dumps(record_copy)


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


@pytest.fixture
def preliminary_record(test_perf_alert):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    return BackfillRecord.objects.create(alert=test_perf_alert, report=report)


@pytest.fixture
def record_ready_for_processing(test_perf_alert, record_context_sample):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(
        alert=test_perf_alert,
        report=report,
        status=BackfillRecord.READY_FOR_PROCESSING,
    )
    record.set_context(record_context_sample)
    record.save()
    return record


@pytest.fixture
def report_maintainer_mock():
    return type('', (), {'provide_updated_reports': lambda *params: []})


@pytest.fixture
def backfill_tool_mock():
    def backfill_job(job_id):
        if job_id is None:
            raise Job.DoesNotExist
        return 'RANDOM_TASK_ID'

    return type('', (), {'backfill_job': backfill_job})


@pytest.fixture
def secretary():
    return SecretaryTool()


@pytest.fixture
def sheriff_settings(secretary, db):
    secretary.validate_settings()
    return PerformanceSettings.objects.get(name='perf_sheriff_bot')


@pytest.fixture
def empty_sheriff_settings(secretary):
    all_of_them = 1_000_000_000
    secretary.validate_settings()
    secretary.consume_backfills(on_platform='linux', amount=all_of_them)
    return PerformanceSettings.objects.get(name='perf_sheriff_bot')


def test_assert_can_run_throws_exception_when_runtime_exceeded(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sheriff_settings,
):
    no_time_left = timedelta(seconds=0)
    sheriff_settings = PerfSheriffBot(
        report_maintainer_mock, backfill_tool_mock, secretary, no_time_left, **FEATURE_FLAGS
    )

    with pytest.raises(MaxRuntimeExceeded):
        sheriff_settings.assert_can_run()


def test_assert_can_run_doesnt_throw_exception_when_enough_time_left(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sheriff_settings,
):
    enough_time_left = timedelta(minutes=10)
    sheriff_settings = PerfSheriffBot(
        report_maintainer_mock, backfill_tool_mock, secretary, enough_time_left, **FEATURE_FLAGS
    )

    try:
        sheriff_settings.assert_can_run()
    except MaxRuntimeExceeded:
        pytest.fail()


def test_records_and_db_limits_remain_unchanged_if_no_records_suitable_for_backfill(
    report_maintainer_mock, backfill_tool_mock, secretary, sheriff_settings, preliminary_record
):
    sheriff_bot = PerfSheriffBot(
        report_maintainer_mock, backfill_tool_mock, secretary, **FEATURE_FLAGS
    )
    sheriff_bot._backfill()

    assert not has_changed(preliminary_record)
    assert not has_changed(sheriff_settings)


def test_records_remain_unchanged_if_no_backfills_left(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    empty_sheriff_settings,
):
    sheriff_bot = PerfSheriffBot(
        report_maintainer_mock, backfill_tool_mock, secretary, **FEATURE_FLAGS
    )
    sheriff_bot._backfill()

    assert not has_changed(record_ready_for_processing)


def test_records_and_db_limits_remain_unchanged_if_runtime_exceeded(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sheriff_settings,
):
    no_time_left = timedelta(seconds=0)
    sheriff_bot = PerfSheriffBot(
        report_maintainer_mock, backfill_tool_mock, secretary, no_time_left, **FEATURE_FLAGS
    )
    try:
        sheriff_bot.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])
    except MaxRuntimeExceeded:
        pass

    assert not has_changed(record_ready_for_processing)
    assert not has_changed(sheriff_settings)


def test_db_limits_update_if_backfills_left(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sheriff_settings,
):
    initial_backfills = secretary.backfills_left(on_platform='linux')
    sheriff_bot = PerfSheriffBot(
        report_maintainer_mock, backfill_tool_mock, secretary, **FEATURE_FLAGS
    )
    sheriff_bot._backfill()

    record_ready_for_processing.refresh_from_db()
    assert record_ready_for_processing.status == BackfillRecord.BACKFILLED
    assert (initial_backfills - 5) == secretary.backfills_left(on_platform='linux')


def test_backfilling_gracefully_handles_invalid_json_contexts_without_blowing_up(
    report_maintainer_mock,
    backfill_tool_mock,
    secretary,
    record_ready_for_processing,
    sheriff_settings,
    broken_context_str,  # Note: parametrizes the test
):
    record_ready_for_processing.context = broken_context_str
    record_ready_for_processing.save()

    sheriff_bot = PerfSheriffBot(
        report_maintainer_mock, backfill_tool_mock, secretary, **FEATURE_FLAGS
    )
    try:
        sheriff_bot.sheriff(since=EPOCH, frameworks=['raptor', 'talos'], repositories=['autoland'])
    except (JSONDecodeError, KeyError, Job.DoesNotExist):
        pytest.fail()

    record_ready_for_processing.refresh_from_db()

    assert record_ready_for_processing.status == BackfillRecord.FAILED
    assert not has_changed(sheriff_settings)
