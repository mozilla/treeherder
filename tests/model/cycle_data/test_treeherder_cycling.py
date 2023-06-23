from datetime import datetime, timedelta

import pytest
from django.core.management import call_command
from django.db.models import Max

from tests import test_utils
from tests.autoclassify.utils import create_failure_lines, test_line
from treeherder.model.models import Job, FailureLine, JobLog, JobType, Machine, JobGroup
from treeherder.perf.models import PerformanceDatum


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

    for object_type, objects in extra_objects.values():
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


# Treeherder's data cycling can have some impact upon
# Perfherder data. Test cases touching this aspect
# should be defined bellow.


def test_cycle_job_with_performance_data(
    test_repository, failure_classifications, test_job, mock_log_parser, test_perf_signature
):
    """
    Ensure that removing Treeherder jobs won't CASCADE DELETE to
    `performance_datum` rows, as this would have dire consequences.
    Rather the perf rows remain, but with their `job` foreign key set to NULL.
    """
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
    p = PerformanceDatum.objects.filter(id=1).first()
    assert p is None
