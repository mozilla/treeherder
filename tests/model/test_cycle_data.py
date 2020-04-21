import datetime

import pytest
from django.core.management import call_command
from django.db.models import Max

from tests import test_utils
from tests.autoclassify.utils import create_failure_lines, test_line
from treeherder.model.management.commands.cycle_data import (
    MINIMUM_PERFHERDER_EXPIRE_INTERVAL,
    PerfherderCycler,
)
from treeherder.model.models import (
    FailureLine,
    Job,
    JobDetail,
    JobGroup,
    JobLog,
    JobType,
    Machine,
    Push,
)
from treeherder.perf.exceptions import MaxRuntimeExceeded
from treeherder.perf.models import PerformanceDatum, PerformanceDatumManager, PerformanceSignature


def test_cycle_all_data(
    test_repository,
    failure_classifications,
    sample_data,
    sample_push,
    mock_log_parser,
    failure_lines,
):
    """
    Test cycling the sample data
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push, False)

    # set the submit time to be a week before today
    cycle_date_ts = datetime.datetime.now() - datetime.timedelta(weeks=1)
    for job in Job.objects.all():
        job.submit_time = cycle_date_ts
        job.save()

    call_command('cycle_data', 'from:treeherder', sleep_time=0, days=1)

    # There should be no jobs or failure lines after cycling
    assert Job.objects.count() == 0
    assert FailureLine.objects.count() == 0
    assert JobDetail.objects.count() == 0
    assert JobLog.objects.count() == 0


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
    job_not_deleted.submit_time = datetime.datetime.now()
    job_not_deleted.save()

    extra_objects = {
        'failure_lines': (
            FailureLine,
            create_failure_lines(
                job_not_deleted, [(test_line, {}), (test_line, {"subtest": "subtest2"})]
            ),
        ),
        'job_details': (
            JobDetail,
            [JobDetail.objects.create(job=job_not_deleted, title='test', value='testvalue')],
        ),
    }

    # set other job's submit time to be a week ago from now
    cycle_date_ts = datetime.datetime.now() - datetime.timedelta(weeks=1)
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
    cycle_date_ts = datetime.datetime.now() - datetime.timedelta(weeks=1)
    for job in Job.objects.all():
        job.submit_time = cycle_date_ts
        job.save()

    create_failure_lines(Job.objects.get(id=1), [(test_line, {})] * 7)

    call_command('cycle_data', 'from:treeherder', sleep_time=0, days=1, chunk_size=3)

    # There should be no jobs after cycling
    assert Job.objects.count() == 0
    assert FailureLine.objects.count() == 0
    assert JobDetail.objects.count() == 0


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
    test_job.submit_time = datetime.datetime.now() - datetime.timedelta(weeks=1)
    test_job.save()

    p = PerformanceDatum.objects.create(
        repository=test_repository,
        result_set_id=1,
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
    'repository_name, command_options, subcommand_options, should_expire',
    [
        ('autoland', '--days=365', None, True),
        ('mozilla-inbound', '--days=365', None, True),
        ('mozilla-beta', '--days=365', None, True),
        ('mozilla-central', '--days=365', None, True),
        ('autoland', '--days=401', None, False),
    ],
)
def test_cycle_performance_data(
    test_repository,
    repository_name,
    push_stored,
    test_perf_signature,
    command_options,
    subcommand_options,
    should_expire,
):
    test_repository.name = repository_name
    test_repository.save()

    expired_timestamp = datetime.datetime.now() - datetime.timedelta(days=400)

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
    push1.time = datetime.datetime.now()
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
        ['cycle_data', command_options, 'from:perfherder', subcommand_options],
    )
    call_command(*list(command))  # test repository isn't a main one

    if should_expire:
        assert list(PerformanceDatum.objects.values_list('id', flat=True)) == [1]
        assert list(PerformanceSignature.objects.values_list('id', flat=True)) == [
            test_perf_signature.id
        ]
    else:
        assert PerformanceDatum.objects.count() == 2
        assert PerformanceSignature.objects.count() == 2


def test_performance_cycler_quit_indicator():
    ten_minutes_ago = datetime.datetime.now() - datetime.timedelta(minutes=10)
    max_one_second = datetime.timedelta(seconds=1)

    two_seconds_ago = datetime.datetime.now() - datetime.timedelta(seconds=2)
    max_five_minutes = datetime.timedelta(minutes=5)

    with pytest.raises(MaxRuntimeExceeded):
        PerformanceDatumManager._maybe_quit(
            started_at=ten_minutes_ago, max_overall_runtime=max_one_second
        )

    try:
        PerformanceDatumManager._maybe_quit(
            started_at=two_seconds_ago, max_overall_runtime=max_five_minutes
        )
    except MaxRuntimeExceeded:
        pytest.fail('Performance cycling shouldn\'t have quit')


def test_performance_cycler_doesnt_delete_too_recent_data():
    down_to_last_year = MINIMUM_PERFHERDER_EXPIRE_INTERVAL
    dangerously_recent = 40

    with pytest.raises(ValueError):
        PerfherderCycler(days=dangerously_recent, chunk_size=1000, sleep_time=0)

    try:
        PerfherderCycler(days=down_to_last_year, chunk_size=1000, sleep_time=0)
    except ValueError:
        pytest.fail('Should be able to expire data older than one year')
