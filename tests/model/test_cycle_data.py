from datetime import datetime, timedelta

import pytest
from django.core.management import call_command
from django.db.models import Max

from tests import test_utils
from tests.autoclassify.utils import create_failure_lines, test_line
from treeherder.model.management.commands.cycle_data import PerfherderCycler
from treeherder.model.models import (
    FailureLine,
    Job,
    JobGroup,
    JobLog,
    JobType,
    Machine,
    Push,
)
from treeherder.perf.exceptions import MaxRuntimeExceeded
from treeherder.perf.models import (
    PerformanceDatum,
    PerformanceSignature,
    PerformanceAlertSummary,
    PerformanceAlert,
)


@pytest.mark.parametrize(
    'days, expected_jobs, expected_failure_lines, expected_job_logs, cmd_args, cmd_kwargs',
    [
        (7, 0, 0, 0, ('cycle_data', 'from:treeherder'), {'sleep_time': 0, 'days': 1}),
        # also check default '--days' param from treeherder
        (119, 20, 2, 22, ('cycle_data',), {'sleep_time': 0}),
        (120, 0, 0, 0, ('cycle_data',), {'sleep_time': 0}),
        (150, 0, 0, 0, ('cycle_data',), {'sleep_time': 0}),
    ],
)
def test_cycle_all_data(
    test_repository,
    failure_classifications,
    sample_data,
    sample_push,
    mock_log_parser,
    failure_lines,
    days,
    expected_jobs,
    expected_failure_lines,
    expected_job_logs,
    cmd_args,
    cmd_kwargs,
):
    """
    Test cycling the sample data
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push, False)

    cycle_date_ts = datetime.now() - timedelta(days=days)
    for job in Job.objects.all():
        job.submit_time = cycle_date_ts
        job.save()

    call_command(*cmd_args, **cmd_kwargs)

    # There should be no jobs or failure lines after cycling
    assert Job.objects.count() == expected_jobs
    assert FailureLine.objects.count() == expected_failure_lines
    assert JobLog.objects.count() == expected_job_logs


def test_cycle_all_but_one_job(
    test_repository,
    failure_classifications,
    sample_data,
    sample_push,
    mock_log_parser,
    failure_lines,
):
    """
    Test cycling all but one job in a group of jobs to confirm there are no
    unexpected deletions
    """

    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push, False)

    # one job should not be deleted, set its submit time to now
    job_not_deleted = Job.objects.get(id=Job.objects.aggregate(Max("id"))["id__max"])
    job_not_deleted.submit_time = datetime.now()
    job_not_deleted.save()

    extra_objects = {
        'failure_lines': (
            FailureLine,
            create_failure_lines(
                job_not_deleted, [(test_line, {}), (test_line, {"subtest": "subtest2"})]
            ),
        ),
    }

    # set other job's submit time to be a week ago from now
    cycle_date_ts = datetime.now() - timedelta(weeks=1)
    for job in Job.objects.all().exclude(id=job_not_deleted.id):
        job.submit_time = cycle_date_ts
        job.save()
    num_job_logs_to_be_deleted = JobLog.objects.all().exclude(job__id=job_not_deleted.id).count()
    num_job_logs_before = JobLog.objects.count()

    call_command('cycle_data', 'from:treeherder', sleep_time=0, days=1, debug=True, chunk_size=1)

    assert Job.objects.count() == 1
    assert JobLog.objects.count() == (num_job_logs_before - num_job_logs_to_be_deleted)

    for (object_type, objects) in extra_objects.values():
        actual = set(item.id for item in object_type.objects.all())
        expected = set(item.id for item in objects)
        assert actual == expected


def test_cycle_all_data_in_chunks(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    """
    Test cycling the sample data in chunks.
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push, False)

    # build a date that will cause the data to be cycled
    cycle_date_ts = datetime.now() - timedelta(weeks=1)
    for job in Job.objects.all():
        job.submit_time = cycle_date_ts
        job.save()

    create_failure_lines(Job.objects.get(id=1), [(test_line, {})] * 7)

    call_command('cycle_data', 'from:treeherder', sleep_time=0, days=1, chunk_size=3)

    # There should be no jobs after cycling
    assert Job.objects.count() == 0
    assert FailureLine.objects.count() == 0


def test_cycle_job_model_reference_data(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push, False)

    # get a list of ids of original reference data
    original_job_type_ids = JobType.objects.values_list('id', flat=True)
    original_job_group_ids = JobGroup.objects.values_list('id', flat=True)
    original_machine_ids = Machine.objects.values_list('id', flat=True)

    # create a bunch of job model data that should be cycled, since they don't
    # reference any current jobs
    jg = JobGroup.objects.create(symbol='moo', name='moo')
    jt = JobType.objects.create(symbol='mu', name='mu')
    m = Machine.objects.create(name='machine_with_no_job')
    (jg_id, jt_id, m_id) = (jg.id, jt.id, m.id)
    call_command('cycle_data', 'from:treeherder', sleep_time=0, days=1, chunk_size=3)

    # assert that reference data that should have been cycled, was cycled
    assert JobGroup.objects.filter(id=jg_id).count() == 0
    assert JobType.objects.filter(id=jt_id).count() == 0
    assert Machine.objects.filter(id=m_id).count() == 0

    # assert that we still have everything that shouldn't have been cycled
    assert JobType.objects.filter(id__in=original_job_type_ids).count() == len(
        original_job_type_ids
    )
    assert JobGroup.objects.filter(id__in=original_job_group_ids).count() == len(
        original_job_group_ids
    )
    assert Machine.objects.filter(id__in=original_machine_ids).count() == len(original_machine_ids)


def test_cycle_job_with_performance_data(
    test_repository, failure_classifications, test_job, mock_log_parser, test_perf_signature
):
    # build a date that will cause the data to be cycled
    test_job.submit_time = datetime.now() - timedelta(weeks=1)
    test_job.save()

    PerformanceDatum.objects.create(
        repository=test_repository,
        push=test_job.push,
        job=test_job,
        signature=test_perf_signature,
        push_timestamp=test_job.push.time,
        value=1.0,
    )

    call_command('cycle_data', 'from:treeherder', sleep_time=0, days=1, chunk_size=3)

    # assert that the job got cycled
    assert Job.objects.count() == 0

    # assert that the perf object is still there, but the job reference is None
    p = PerformanceDatum.objects.get(id=1)
    assert p.job is None


@pytest.mark.parametrize(
    'repository_name',
    [
        'autoland',
        'mozilla-inbound',
        'mozilla-beta',
        'mozilla-central',
    ],
)
def test_cycle_performance_data(
    test_repository,
    try_repository,
    repository_name,
    push_stored,
    test_perf_signature,
):
    test_repository.name = repository_name
    test_repository.save()

    expired_timestamp = datetime.now() - timedelta(days=400)

    test_perf_signature_2 = PerformanceSignature.objects.create(
        signature_hash='b' * 40,
        repository=test_perf_signature.repository,
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite=test_perf_signature.suite,
        test='test 2',
        last_updated=expired_timestamp,
        has_subtests=False,
    )

    push1 = Push.objects.get(id=1)
    push1.time = datetime.now()
    push1.save()

    push2 = Push.objects.get(id=2)
    push2.time = expired_timestamp
    push2.save()

    # this shouldn't be deleted in any circumstance
    PerformanceDatum.objects.create(
        id=1,
        repository=test_repository,
        push=push1,
        job=None,
        signature=test_perf_signature,
        push_timestamp=push1.time,
        value=1.0,
    )

    # the performance datum that which we're targetting
    PerformanceDatum.objects.create(
        id=2,
        repository=test_repository,
        push=push2,
        job=None,
        signature=test_perf_signature_2,
        push_timestamp=push2.time,
        value=1.0,
    )

    command = filter(
        lambda arg: arg is not None,
        ['cycle_data', 'from:perfherder'],
    )
    call_command(*list(command))  # test repository isn't a main one

    assert list(PerformanceDatum.objects.values_list('id', flat=True)) == [1]
    assert list(PerformanceSignature.objects.values_list('id', flat=True)) == [
        test_perf_signature.id
    ]


def test_performance_signatures_are_deleted(test_perf_signature):
    cycler = PerfherderCycler(chunk_size=100, sleep_time=0)
    expired_timestamp = cycler.max_timestamp

    perf_signature_to_delete = PerformanceSignature.objects.create(
        signature_hash='b' * 40,
        repository=test_perf_signature.repository,
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite=test_perf_signature.suite,
        test='test_perf_signature_to_delete',
        last_updated=expired_timestamp,
        has_subtests=False,
    )

    perf_signature_to_keep = PerformanceSignature.objects.create(
        signature_hash='h' * 40,
        repository=test_perf_signature.repository,
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite=test_perf_signature.suite,
        test='test_perf_signature_to_keep',
        last_updated=datetime.now(),
        has_subtests=False,
    )

    call_command('cycle_data', 'from:perfherder')

    assert perf_signature_to_keep.id in list(
        PerformanceSignature.objects.values_list('id', flat=True)
    )
    assert perf_signature_to_delete.id not in list(
        PerformanceSignature.objects.values_list('id', flat=True)
    )


def test_try_data_removal(
    try_repository, test_repository, try_push_stored, test_perf_signature, test_perf_signature_2
):
    total_removals = 3
    test_perf_signature.repository = try_repository
    test_perf_signature.save()

    try_pushes = list(Push.objects.filter(repository=try_repository).order_by('id').all())

    for idx, push in enumerate(try_pushes[:-2]):
        push_timestamp = datetime.now()
        if idx < total_removals:
            push_timestamp -= timedelta(weeks=10)

        PerformanceDatum.objects.create(
            repository=try_repository,
            push=push,
            job=None,
            signature=test_perf_signature,
            push_timestamp=push_timestamp,
            value=1.0,
        )

    for push in try_pushes[-2:]:
        push_timestamp = datetime.now() - timedelta(weeks=10)

        # try data removal shouldn't delete these non-try data
        PerformanceDatum.objects.create(
            repository=test_repository,
            push=push,
            job=None,
            signature=test_perf_signature_2,
            push_timestamp=push_timestamp,
            value=1.0,
        )

    total_initial_data = PerformanceDatum.objects.count()

    call_command('cycle_data', 'from:perfherder')
    assert PerformanceDatum.objects.count() == total_initial_data - total_removals
    assert not PerformanceDatum.objects.filter(
        push_timestamp__lt=datetime.now() - timedelta(weeks=6),
        repository=try_repository,
    ).exists()
    assert (
        PerformanceDatum.objects.exclude(repository=try_repository).count() == 2
    )  # non-try data remained intact


@pytest.mark.parametrize(
    'repository_name',
    ['autoland', 'mozilla-beta', 'mozilla-central', 'fenix', 'reference-browser'],
)
def test_irrelevant_repos_data_removal(
    test_repository,
    relevant_repository,
    repository_name,
    push_stored,
    test_perf_signature,
):
    # test_repository is considered irrelevant repositories

    relevant_repository.name = repository_name
    relevant_repository.save()

    six_months_ago_timestamp = datetime.now() - timedelta(days=(6 * 30))

    push = Push.objects.first()

    # performance datum for irrelevant repository which has an expired push_timestamp ( older than 6 months )
    # this one should be deleted, because it's expired
    PerformanceDatum.objects.create(
        repository=test_repository,
        push=push,
        job=None,
        signature=test_perf_signature,
        push_timestamp=six_months_ago_timestamp,
        value=1.0,
    )

    # performance datum for relevant repository which has a push_timestamp older than 6 months
    # this one should still be kept in db
    PerformanceDatum.objects.create(
        repository=relevant_repository,
        push=push,
        job=None,
        signature=test_perf_signature,
        push_timestamp=six_months_ago_timestamp,
        value=1.0,
    )

    # performance datum for irrelevant repository which has a one week old push_timestamp
    # this one should still be kept in db
    PerformanceDatum.objects.create(
        repository=test_repository,
        push=push,
        job=None,
        signature=test_perf_signature,
        push_timestamp=datetime.now() - timedelta(weeks=1),
        value=1.0,
    )

    total_initial_data = PerformanceDatum.objects.count()

    call_command('cycle_data', 'from:perfherder')
    assert PerformanceDatum.objects.count() == total_initial_data - 1
    assert PerformanceDatum.objects.filter(repository=relevant_repository).exists()
    assert not PerformanceDatum.objects.filter(
        push_timestamp__lte=six_months_ago_timestamp,
        repository=test_repository,
    ).exists()


def test_performance_cycler_quit_indicator():
    ten_minutes_ago = datetime.now() - timedelta(minutes=10)
    one_second = timedelta(seconds=1)

    two_seconds_ago = datetime.now() - timedelta(seconds=2)
    five_minutes = timedelta(minutes=5)

    with pytest.raises(MaxRuntimeExceeded):
        cycler = PerfherderCycler(chunk_size=100, sleep_time=0, max_runtime=one_second)
        cycler.started_at = ten_minutes_ago

        cycler._quit_on_timeout()

    try:
        cycler = PerfherderCycler(chunk_size=100, sleep_time=0, max_runtime=five_minutes)
        cycler.started_at = two_seconds_ago

        cycler._quit_on_timeout()
    except MaxRuntimeExceeded:
        pytest.fail('Performance cycling shouldn\'t have timed out')


@pytest.fixture
def empty_alert_summary(
    test_repository, push_stored, test_perf_framework, test_issue_tracker
) -> PerformanceAlertSummary:
    return PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=3,
        manually_created=True,
    )


@pytest.mark.parametrize(
    'expired_time',
    [
        datetime.now() - timedelta(days=365),
        datetime.now() - timedelta(days=181),
        datetime.now() - timedelta(days=180, hours=1),
    ],
)
def test_summary_without_any_kind_of_alerts_is_deleted(expired_time, empty_alert_summary):
    empty_alert_summary.created = expired_time
    empty_alert_summary.save()

    assert PerformanceAlertSummary.objects.count() == 1
    assert empty_alert_summary.alerts.count() == 0
    assert empty_alert_summary.related_alerts.count() == 0

    call_command('cycle_data', 'from:perfherder')
    assert not PerformanceAlertSummary.objects.exists()


@pytest.mark.parametrize(
    'recently',
    [
        datetime.now(),
        datetime.now() - timedelta(minutes=30),
        datetime.now() - timedelta(weeks=4),
        datetime.now() - timedelta(days=179, hours=23),
    ],
)
def test_summary_without_any_kind_of_alerts_isnt_deleted(recently, empty_alert_summary):
    empty_alert_summary.created = recently
    empty_alert_summary.save()

    assert PerformanceAlertSummary.objects.count() == 1
    assert empty_alert_summary.alerts.count() == 0
    assert empty_alert_summary.related_alerts.count() == 0

    call_command('cycle_data', 'from:perfherder')
    assert PerformanceAlertSummary.objects.count() == 1


@pytest.mark.parametrize(
    'creation_time',
    [
        # expired
        datetime.now() - timedelta(days=365),
        datetime.now() - timedelta(days=181),
        datetime.now() - timedelta(days=180, hours=1),
        # not expired
        datetime.now(),
        datetime.now() - timedelta(minutes=30),
        datetime.now() - timedelta(weeks=4),
        datetime.now() - timedelta(days=179, hours=23),
    ],
)
def test_summary_with_alerts_isnt_deleted(
    creation_time, empty_alert_summary, test_perf_alert, test_perf_alert_2, test_perf_data
):
    empty_alert_summary.created = creation_time
    empty_alert_summary.save()

    test_perf_data = list(test_perf_data)
    for datum in test_perf_data[2:]:
        datum.signature = test_perf_alert_2.series_signature
        datum.repository = test_perf_alert_2.series_signature.repository
        datum.save()

    # with alerts only
    test_perf_alert.summary = empty_alert_summary
    test_perf_alert.save()

    assert PerformanceAlertSummary.objects.filter(id=empty_alert_summary.id).exists()
    assert empty_alert_summary.alerts.count() == 1
    assert empty_alert_summary.related_alerts.count() == 0

    call_command('cycle_data', 'from:perfherder')
    assert PerformanceAlertSummary.objects.filter(id=empty_alert_summary.id).exists()

    # with both
    test_perf_alert_2.status = PerformanceAlert.REASSIGNED
    empty_alert_summary.related_alerts.add(test_perf_alert_2, bulk=False)

    assert PerformanceAlertSummary.objects.filter(id=empty_alert_summary.id).exists()
    assert empty_alert_summary.alerts.count() == 1
    assert empty_alert_summary.related_alerts.count() == 1

    call_command('cycle_data', 'from:perfherder')
    assert PerformanceAlertSummary.objects.filter(id=empty_alert_summary.id).exists()

    # with related_alerts only
    test_perf_alert.delete()

    assert PerformanceAlertSummary.objects.filter(id=empty_alert_summary.id).exists()
    assert empty_alert_summary.alerts.count() == 0
    assert empty_alert_summary.related_alerts.count() == 1

    call_command('cycle_data', 'from:perfherder')
    assert PerformanceAlertSummary.objects.filter(id=empty_alert_summary.id).exists()
