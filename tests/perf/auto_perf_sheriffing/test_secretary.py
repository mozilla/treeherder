import uuid
from datetime import datetime, timedelta

import pytest
import simplejson as json

from django.db.models import Q

from treeherder.config.settings import IS_WINDOWS
from treeherder.perf.auto_perf_sheriffing.secretary import Secretary
from treeherder.model.models import Job, Push
from treeherder.perf.models import BackfillRecord, BackfillReport, PerformanceSettings
from treeherder.perf.auto_perf_sheriffing.outcome_checker import OutcomeChecker, OutcomeStatus

# we're testing against this (automatically provided by fixtures)
JOB_TYPE_ID = 1


def get_middle_index(successful_jobs):
    # get middle index to make sure the push is in range
    index_in_range = int((len(successful_jobs) + 1) / 2)
    return index_in_range


def set_record_job_type(record, job_type_id=JOB_TYPE_ID):
    record.job_type_id = job_type_id
    record.save()


@pytest.fixture
def record_backfilled(test_perf_alert, record_context_sample):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(
        alert=test_perf_alert,
        report=report,
        status=BackfillRecord.BACKFILLED,
    )
    record.set_context(record_context_sample)
    record.save()
    return record


@pytest.fixture
def range_dates(record_context_sample):
    from_date = datetime.fromisoformat(record_context_sample[0]['push_timestamp'])
    to_date = datetime.fromisoformat(record_context_sample[-1]['push_timestamp'])

    return {
        'before_date': from_date - timedelta(days=5),
        'from_date': from_date,
        'in_range_date': from_date + timedelta(hours=13),
        'to_date': to_date,
        'after_date': to_date + timedelta(days=3),
    }


@pytest.fixture
def outcome_checking_pushes(
    create_push, range_dates, record_context_sample, test_repository, test_repository_2
):
    from_push_id = record_context_sample[0]['push_id']
    to_push_id = record_context_sample[-1]['push_id']

    pushes = [
        create_push(test_repository, revision=uuid.uuid4(), time=range_dates['before_date']),
        create_push(
            test_repository,
            revision=uuid.uuid4(),
            time=range_dates['from_date'],
            explicit_id=from_push_id,
        ),
        create_push(test_repository, revision=uuid.uuid4(), time=range_dates['in_range_date']),
        create_push(test_repository, revision=uuid.uuid4(), time=range_dates['in_range_date']),
        create_push(test_repository, revision=uuid.uuid4(), time=range_dates['in_range_date']),
        create_push(test_repository, revision=uuid.uuid4(), time=range_dates['in_range_date']),
        create_push(
            test_repository,
            revision=uuid.uuid4(),
            time=range_dates['to_date'],
            explicit_id=to_push_id,
        ),
        create_push(test_repository, revision=uuid.uuid4(), time=range_dates['after_date']),
    ]

    return pushes


@pytest.fixture
def successful_jobs(outcome_checking_pushes, eleven_jobs_stored):
    jobs = Job.objects.all()
    _successful_jobs = []
    pairs = zip(outcome_checking_pushes, jobs)
    for push, job in pairs:
        job.push = push
        job.result = 'success'
        job.job_type_id = JOB_TYPE_ID
        job.save()
        _successful_jobs.append(job)
    return _successful_jobs


@pytest.fixture
def jobs_with_one_failed(successful_jobs):
    index_in_range = get_middle_index(successful_jobs)
    job_to_fail = successful_jobs[index_in_range]
    job_to_fail.result = 'testfailed'
    job_to_fail.save()


@pytest.fixture
def jobs_with_one_pending(successful_jobs):
    index_in_range = get_middle_index(successful_jobs)
    job_pending = successful_jobs[index_in_range]
    job_pending.result = 'unknown'
    job_pending.save()


@pytest.fixture
def jobs_with_one_pending_and_one_failed(successful_jobs):
    index_in_range = get_middle_index(successful_jobs)
    next_index_in_range = get_middle_index(successful_jobs) + 1
    job_pending = successful_jobs[index_in_range]
    job_pending.result = 'unknown'
    job_pending.save()
    job_to_fail = successful_jobs[next_index_in_range]
    job_to_fail.result = 'testfailed'
    job_to_fail.save()


@pytest.fixture
def get_outcome_checker_mock():
    def get_outcome_checker_mock(outcome: OutcomeStatus):
        return type('', (), {'check': lambda *params: outcome})

    return get_outcome_checker_mock


@pytest.mark.skipif(IS_WINDOWS, reason="datetime logic does not work when OS not on GMT")
def test_secretary_updates_only_matured_reports(
    test_perf_alert, create_record, record_from_mature_report
):
    # create new report with records
    create_record(test_perf_alert)

    assert BackfillRecord.objects.count() == 2
    assert BackfillRecord.objects.filter(status=BackfillRecord.PRELIMINARY).count() == 2

    Secretary.mark_reports_for_backfill()
    assert BackfillRecord.objects.filter(status=BackfillRecord.PRELIMINARY).count() == 1


def test_secretary_uses_existing_settings(performance_settings):
    assert PerformanceSettings.objects.count() == 1
    last_reset_date_before = json.loads(performance_settings.settings)["last_reset_date"]

    Secretary.validate_settings()

    assert PerformanceSettings.objects.count() == 1
    settings_after = PerformanceSettings.objects.filter(name="perf_sheriff_bot").first()
    assert json.loads(settings_after.settings)["last_reset_date"] == last_reset_date_before


def test_secretary_resets_settings_if_expired(expired_performance_settings):
    assert PerformanceSettings.objects.count() == 1
    expired_last_reset_date = json.loads(expired_performance_settings.settings)["last_reset_date"]

    Secretary.validate_settings()

    assert PerformanceSettings.objects.count() == 1
    settings_after = PerformanceSettings.objects.filter(name="perf_sheriff_bot").first()
    assert json.loads(settings_after.settings)["last_reset_date"] != expired_last_reset_date


def test_secretary_creates_new_settings_if_none_exist(db):
    assert PerformanceSettings.objects.count() == 0

    Secretary.validate_settings()

    assert PerformanceSettings.objects.count() == 1


def test_outcome_checker_identifies_pushes_in_range(
    record_backfilled, test_repository, test_repository_2, range_dates, outcome_checking_pushes
):
    total_pushes = Push.objects.count()

    from_time = range_dates['from_date']
    to_time = range_dates['to_date']

    total_outside_pushes = Push.objects.filter(
        Q(time__lt=from_time) | Q(time__gt=to_time), repository=test_repository
    ).count()

    pushes_in_range = record_backfilled.get_pushes_in_context_range()
    assert len(pushes_in_range) == total_pushes - total_outside_pushes

    # change repository for the first 2 pushes in range
    assert test_repository.id != test_repository_2.id

    total_changed_pushes = 2
    for push in pushes_in_range[:total_changed_pushes]:
        push.repository = test_repository_2
        push.save()

    total_other_repo_pushes = Push.objects.filter(repository=test_repository_2).count()
    assert total_other_repo_pushes == total_changed_pushes

    updated_pushes_in_range = record_backfilled.get_pushes_in_context_range()

    assert len(updated_pushes_in_range) == len(pushes_in_range) - total_other_repo_pushes


def test_check_outcome_after_success(get_outcome_checker_mock, record_backfilled):
    outcome_checker_mock = get_outcome_checker_mock(OutcomeStatus.SUCCESSFUL)
    secretary = Secretary(outcome_checker_mock)

    assert BackfillRecord.objects.filter(status=BackfillRecord.BACKFILLED).count() == 1
    assert BackfillRecord.objects.filter(status=BackfillRecord.SUCCESSFUL).count() == 0
    secretary.check_outcome()
    assert BackfillRecord.objects.filter(status=BackfillRecord.BACKFILLED).count() == 0
    assert BackfillRecord.objects.filter(status=BackfillRecord.SUCCESSFUL).count() == 1


def test_check_outcome_after_fail(get_outcome_checker_mock, record_backfilled):
    outcome_checker_mock = get_outcome_checker_mock(OutcomeStatus.FAILED)
    secretary = Secretary(outcome_checker_mock)

    assert BackfillRecord.objects.filter(status=BackfillRecord.BACKFILLED).count() == 1
    assert BackfillRecord.objects.filter(status=BackfillRecord.FAILED).count() == 0
    secretary.check_outcome()
    assert BackfillRecord.objects.filter(status=BackfillRecord.BACKFILLED).count() == 0
    assert BackfillRecord.objects.filter(status=BackfillRecord.FAILED).count() == 1


def test_no_action_when_in_progress(get_outcome_checker_mock, record_backfilled):
    outcome_checker_mock = get_outcome_checker_mock(OutcomeStatus.IN_PROGRESS)
    secretary = Secretary(outcome_checker_mock)

    assert BackfillRecord.objects.filter(status=BackfillRecord.BACKFILLED).count() == 1
    secretary.check_outcome()
    assert BackfillRecord.objects.filter(status=BackfillRecord.BACKFILLED).count() == 1


class TestOutcomeChecker:
    def test_successful_jobs_mean_successful_outcome(
        self, record_backfilled, outcome_checking_pushes, successful_jobs
    ):
        set_record_job_type(record_backfilled)
        outcome_checker = OutcomeChecker()

        response = outcome_checker.check(record_backfilled)
        # all jobs were successful
        assert record_backfilled.get_pushes_in_context_range().count() == 6
        assert record_backfilled.total_backfills_successful == 6
        assert record_backfilled.total_backfills_in_progress == 0
        assert record_backfilled.total_backfills_failed == 0
        assert response == OutcomeStatus.SUCCESSFUL

    def test_failed_job_means_failed_outcome(
        self, record_backfilled, outcome_checking_pushes, jobs_with_one_failed
    ):
        set_record_job_type(record_backfilled)
        outcome_checker = OutcomeChecker()

        response = outcome_checker.check(record_backfilled)
        # one job failed and the rest were successful
        assert record_backfilled.get_pushes_in_context_range().count() == 6
        assert record_backfilled.total_backfills_successful == 5
        assert record_backfilled.total_backfills_in_progress == 0
        assert record_backfilled.total_backfills_failed == 1
        assert response == OutcomeStatus.FAILED

    def test_pending_job_means_in_progress_outcome(
        self, record_backfilled, outcome_checking_pushes, jobs_with_one_pending
    ):
        set_record_job_type(record_backfilled)
        outcome_checker = OutcomeChecker()

        response = outcome_checker.check(record_backfilled)
        # one job is in progress and the rest were successful
        assert record_backfilled.get_pushes_in_context_range().count() == 6
        assert record_backfilled.total_backfills_successful == 5
        assert record_backfilled.total_backfills_in_progress == 1
        assert record_backfilled.total_backfills_failed == 0
        assert response == OutcomeStatus.IN_PROGRESS

    def test_pending_and_failed_jobs_means_in_progress_outcome(
        self, record_backfilled, outcome_checking_pushes, jobs_with_one_pending_and_one_failed
    ):
        set_record_job_type(record_backfilled)
        outcome_checker = OutcomeChecker()

        response = outcome_checker.check(record_backfilled)
        # one job is in progress, one failed and the rest were successful
        assert record_backfilled.get_pushes_in_context_range().count() == 6
        assert record_backfilled.total_backfills_successful == 4
        assert record_backfilled.total_backfills_in_progress == 1
        assert record_backfilled.total_backfills_failed == 1
        assert response == OutcomeStatus.IN_PROGRESS
