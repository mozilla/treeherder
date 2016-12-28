import datetime

from django.core.management import call_command

from tests import test_utils
from tests.autoclassify.utils import (create_failure_lines,
                                      test_line)
from treeherder.model.models import (FailureLine,
                                     Job,
                                     JobDetail,
                                     JobGroup,
                                     JobLog,
                                     JobType,
                                     Machine)
from treeherder.model.search import (TestFailureLine,
                                     refresh_all)
from treeherder.perf.models import PerformanceDatum


def test_cycle_all_data(jm, failure_classifications, sample_data,
                        sample_resultset, test_repository, mock_log_parser,
                        failure_lines):
    """
    Test cycling the sample data
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    # set the submit time to be a week before today
    cycle_date_ts = datetime.datetime.now() - datetime.timedelta(weeks=1)
    for job in Job.objects.all():
        job.submit_time = cycle_date_ts
        job.save()

    call_command('cycle_data', sleep_time=0, days=1)

    refresh_all()

    # There should be no jobs or failure lines after cycling
    assert Job.objects.count() == 0
    assert FailureLine.objects.count() == 0
    assert JobDetail.objects.count() == 0
    assert JobLog.objects.count() == 0

    # There should be nothing in elastic search after cycling
    assert TestFailureLine.search().params(search_type="count").execute().hits.total == 0


def test_cycle_all_but_one_job(jm, failure_classifications, sample_data,
                               sample_resultset, test_repository, mock_log_parser,
                               elasticsearch, failure_lines):
    """
    Test cycling one job in a group of jobs to confirm there are no
    unexpected deletions
    """

    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    # one job should not be deleted, set its submit time to now
    job_not_deleted = Job.objects.get(id=2)
    job_not_deleted.submit_time = datetime.datetime.now()
    job_not_deleted.save()

    extra_objects = {
        'failure_lines': (FailureLine,
                          create_failure_lines(
                              job_not_deleted,
                              [(test_line, {}),
                               (test_line, {"subtest": "subtest2"})])),
        'job_details': (JobDetail, [JobDetail.objects.create(
            job=job_not_deleted,
            title='test',
            value='testvalue')])
    }

    # set other job's submit time to be a week ago from now
    cycle_date_ts = datetime.datetime.now() - datetime.timedelta(weeks=1)
    for job in Job.objects.all().exclude(id=job_not_deleted.id):
        job.submit_time = cycle_date_ts
        job.save()
    num_job_logs_to_be_deleted = JobLog.objects.all().exclude(
        id=job_not_deleted.id).count()
    num_job_logs_before = JobLog.objects.count()

    call_command('cycle_data', sleep_time=0, days=1, debug=True)
    refresh_all()

    assert Job.objects.count() == 1
    assert JobLog.objects.count() == (num_job_logs_before -
                                      num_job_logs_to_be_deleted)

    for (object_type, objects) in extra_objects.values():
        assert (set(item.id for item in object_type.objects.all()) ==
                set(item.id for item in objects))

    assert set(int(item.meta.id) for item in TestFailureLine.search().execute()) == set(item.id for item in extra_objects["failure_lines"][1])


def test_cycle_all_data_in_chunks(jm, failure_classifications, sample_data,
                                  sample_resultset, test_repository, mock_log_parser):
    """
    Test cycling the sample data in chunks.
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    # build a date that will cause the data to be cycled
    cycle_date_ts = datetime.datetime.now() - datetime.timedelta(weeks=1)
    for job in Job.objects.all():
        job.submit_time = cycle_date_ts
        job.save()

    create_failure_lines(Job.objects.get(id=1),
                         [(test_line, {})] * 7)

    assert TestFailureLine.search().params(search_type="count").execute().hits.total > 0

    call_command('cycle_data', sleep_time=0, days=1, chunk_size=3)
    refresh_all()

    # There should be no jobs after cycling
    assert Job.objects.count() == 0
    assert FailureLine.objects.count() == 0
    assert JobDetail.objects.count() == 0
    assert TestFailureLine.search().params(search_type="count").execute().hits.total == 0


def test_cycle_job_model_reference_data(jm, failure_classifications,
                                        sample_data, sample_resultset,
                                        mock_log_parser):
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    # get a list of ids of original reference data
    original_job_type_ids = JobType.objects.values_list('id', flat=True)
    original_job_group_ids = JobGroup.objects.values_list('id', flat=True)
    original_machine_ids = Machine.objects.values_list('id', flat=True)

    # create a bunch of job model data that should be cycled, since they don't
    # reference any current jobs
    jg = JobGroup.objects.create(symbol='moo', name='moo')
    jt = JobType.objects.create(job_group=jg, symbol='mu', name='mu')
    m = Machine.objects.create(name='machine_with_no_job')
    (jg_id, jt_id, m_id) = (jg.id, jt.id, m.id)
    call_command('cycle_data', sleep_time=0, days=1, chunk_size=3)

    # assert that reference data that should have been cycled, was cycled
    assert JobGroup.objects.filter(id=jg_id).count() == 0
    assert JobType.objects.filter(id=jt_id).count() == 0
    assert Machine.objects.filter(id=m_id).count() == 0

    # assert that we still have everything that shouldn't have been cycled
    assert JobType.objects.filter(id__in=original_job_type_ids).count() == len(original_job_type_ids)
    assert JobGroup.objects.filter(id__in=original_job_group_ids).count() == len(original_job_group_ids)
    assert Machine.objects.filter(id__in=original_machine_ids).count() == len(original_machine_ids)


def test_cycle_job_with_performance_data(test_repository, failure_classifications,
                                         test_job, test_perf_signature):
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
        value=1.0)

    call_command('cycle_data', sleep_time=0, days=1, chunk_size=3)

    # assert that the job got cycled
    assert Job.objects.count() == 0

    # assert that the perf object is still there, but the job reference is None
    p = PerformanceDatum.objects.get(id=1)
    assert p.job is None
