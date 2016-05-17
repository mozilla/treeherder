import copy
import time

import pytest
from django.core.management import call_command

from tests import test_utils
from tests.autoclassify.utils import (create_failure_lines,
                                      test_line)
from tests.sample_data_generator import (job_data,
                                         result_set)
from treeherder.model.derived import ArtifactsModel
from treeherder.model.models import (BuildPlatform,
                                     FailureClassification,
                                     FailureLine,
                                     Job,
                                     JobDetail,
                                     JobDuration,
                                     JobGroup,
                                     JobType,
                                     MachinePlatform,
                                     RunnableJob,
                                     TaskSetMeta)
from treeherder.model.search import (TestFailureLine,
                                     refresh_all)

slow = pytest.mark.slow
xfail = pytest.mark.xfail


def test_unicode(jm):
    """Unicode representation of a ``JobModel`` is the project name."""
    assert unicode(jm) == unicode(jm.project)


def test_disconnect(jm):
    """test that your model disconnects"""

    # establish the connection to jobs.
    jm._get_last_insert_id()

    jm.disconnect()
    assert not jm.get_dhub().connection["master_host"]["con_obj"].open


def test_ingest_single_sample_job(jm, sample_data,
                                  sample_resultset, test_repository, mock_log_parser):
    """Process a single job structure in the job_data.txt file"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)


def test_ingest_all_sample_jobs(jm, sample_data,
                                sample_resultset, test_repository, mock_log_parser):
    """
    Process each job structure in the job_data.txt file and verify.
    """
    job_data = sample_data.job_data
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)


@pytest.mark.parametrize("total_resultset_count", [3, 10])
def test_missing_resultsets(jm, sample_data, sample_resultset, test_repository,
                            mock_log_parser, total_resultset_count):
    """
    Ingest some sample jobs, some of which will be missing a resultset.

    When a resultset is missing, it should create a skeleton.  Then have it
    fill in the values by the normal resultset mechanism.
    """

    job_data = sample_data.job_data[:total_resultset_count]
    resultsets_to_store_after = sample_resultset[:3]
    missing_revisions = [r["revision"] for r in resultsets_to_store_after]

    if total_resultset_count > len(missing_revisions):
        # if this is true, then some of the resultsets will get updates,
        # and some won't, otherwise we want to have some other resultsets
        # pre-loaded before the test.
        resultsets_to_store_before = sample_resultset[3:total_resultset_count]
        jm.store_result_set_data(resultsets_to_store_before)

    for idx, rev in enumerate(missing_revisions):
        job_data[idx]["revision"] = rev

    jm.store_job_data(job_data)

    assert len(jm.get_job_list(0, 20)) == total_resultset_count
    test_utils.verify_result_sets(jm, set(missing_revisions))

    result_set_skeletons = jm.get_dhub().execute(
        proc='jobs_test.selects.result_sets',
        return_type='dict',
        key_column="long_revision",
    )
    for rev in missing_revisions:
        resultset = result_set_skeletons[rev]
        assert resultset["short_revision"] == rev[:12]
        assert resultset["author"] == "pending..."
        assert resultset["push_timestamp"] == 0

    jm.store_result_set_data(resultsets_to_store_after)

    # get the resultsets that were created as skeletons and should have now been
    # filled-in by the async task
    updated_resultsets = jm.get_result_set_list(
        0, len(missing_revisions),
        conditions={"long_revision": {("IN", tuple(missing_revisions))}}
    )

    assert len(updated_resultsets) == len(missing_revisions)
    for rs in updated_resultsets:
        assert rs["push_timestamp"] > 0
        assert len(rs["revisions"]) > 0
    act_revisions = {x["revision"] for x in updated_resultsets}
    assert set(missing_revisions).issubset(act_revisions)


def test_missing_resultsets_short_revision(
        jm, sample_data, sample_resultset,
        test_repository, mock_log_parser):
    """
    Ingest a sample job with a short revision.

    Should create an skeleton resultset that fills in and gets the long
    revision
    """
    job_data = sample_data.job_data[:1]

    resultsets_to_store = sample_resultset[:1]
    missing_long_revision = resultsets_to_store[0]["revision"]
    missing_short_revision = missing_long_revision[:12]

    job_data[0]["revision"] = missing_short_revision

    jm.store_job_data(job_data)

    assert len(jm.get_job_list(0, 20)) == 1
    test_utils.verify_result_sets(jm, {missing_short_revision})

    jm.store_result_set_data(resultsets_to_store)

    # get the resultsets that were created as skeletons and should have now been
    # filled-in by the async task
    updated_resultsets = jm.get_result_set_list(
        0, 2,
        conditions={"short_revision": {("=", missing_short_revision)}}
    )

    assert len(updated_resultsets) == 1
    for rs in updated_resultsets:
        assert rs["push_timestamp"] > 0
        assert len(rs["revisions"]) > 0
    act_revisions = {x["revision"] for x in updated_resultsets}
    assert {missing_long_revision} == act_revisions


def test_get_inserted_row_ids(jm, sample_resultset, test_repository):

    slice_limit = 8
    sample_slice = sample_resultset[0:slice_limit]
    new_id_set = set(range(1, len(sample_slice) + 1))

    data = jm.store_result_set_data(sample_slice)

    # Confirm the range of ids matches for the sample_resultset slice
    assert set(data['inserted_result_set_ids']) == new_id_set

    second_pass_data = jm.store_result_set_data(sample_slice)

    # Confirm if we store the same data twice we don't identify new
    # result set ids
    assert second_pass_data['inserted_result_set_ids'] == []

    third_pass_data = jm.store_result_set_data(sample_resultset)

    # Confirm if we store a mix of new result sets and already stored
    # result sets we store/identify the new ones
    assert len(set(third_pass_data['inserted_result_set_ids'])) == \
        len(sample_resultset) - slice_limit


def test_ingest_running_to_retry_sample_job(jm, sample_data,
                                            sample_resultset, test_repository, mock_log_parser):
    """Process a single job structure in the job_data.txt file"""
    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision'] = sample_resultset[0]['revision']

    jm.store_result_set_data(sample_resultset)

    job['state'] = 'running'
    job['result'] = 'unknown'

    # for pending and running jobs, we call this directly, just like
    # the web api does.
    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 1)
    initial_job_id = jl[0]["id"]

    # now we simulate the complete version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry
    job['job_guid'] = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]

    jm.store_job_data(job_data)
    jl = jm.get_job_list(0, 10)

    assert len(jl) == 1
    assert jl[0]['result'] == 'retry'
    assert jl[0]['id'] == initial_job_id

    assert Job.objects.count() == 1
    intermediary_job = Job.objects.all()[0]
    assert intermediary_job.project_specific_id == initial_job_id
    assert intermediary_job.guid == job['job_guid']


def test_ingest_running_to_retry_to_success_sample_job(jm, sample_data,
                                                       sample_resultset, test_repository, mock_log_parser):
    """Process a single job structure in the job_data.txt file"""
    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision'] = sample_resultset[0]['revision']
    job_guid_root = job['job_guid']

    jm.store_result_set_data(sample_resultset)

    job['state'] = 'running'
    job['result'] = 'unknown'
    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 1)
    initial_job_id = jl[0]["id"]

    # now we simulate the complete RETRY version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry
    job['job_guid'] = job_guid_root + "_" + str(job['end_timestamp'])[-5:]

    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1
    assert jl[0]['result'] == 'retry'
    assert jl[0]['id'] == initial_job_id

    assert Job.objects.count() == 1
    intermediary_job = Job.objects.all()[0]
    assert intermediary_job.project_specific_id == jl[0]['id']
    assert intermediary_job.guid == job['job_guid']

    # now we simulate the complete SUCCESS version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'success'
    # convert the job_guid to the normal root style
    job['job_guid'] = job_guid_root

    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 10)

    assert len(jl) == 2
    assert jl[0]['result'] == 'retry'
    assert jl[0]['id'] == initial_job_id
    assert jl[1]['result'] == 'success'

    assert Job.objects.count() == 2
    assert set(Job.objects.values_list('id', flat=True)) == set([j['id'] for j in jl])


def test_ingest_retry_sample_job_no_running(jm, sample_data,
                                            sample_resultset, test_repository, mock_log_parser):
    """Process a single job structure in the job_data.txt file"""
    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision'] = sample_resultset[0]['revision']

    jm.store_result_set_data(sample_resultset)

    # complete version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry
    retry_guid = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]
    job['job_guid'] = retry_guid

    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 10)

    assert len(jl) == 1
    assert jl[0]['job_guid'] == retry_guid
    assert jl[0]['result'] == 'retry'

    assert Job.objects.count() == 1
    assert Job.objects.all()[0].guid == retry_guid


def test_calculate_durations(jm, test_repository, mock_log_parser):
    """
    Test the calculation of average job durations and their use during
    subsequent job ingestion.
    """
    rs = result_set()
    jm.store_result_set_data([rs])
    now = int(time.time())

    first_job_duration = 120
    first_job = job_data(revision=rs['revision'],
                         start_timestamp=now,
                         end_timestamp=now + first_job_duration)
    jm.store_job_data([first_job])

    # Generate average duration based on the first job.
    call_command('calculate_durations')

    # Ingest the same job type again to check that the pre-generated
    # average duration is used during ingestion.
    second_job_duration = 142
    second_job = job_data(revision=rs['revision'],
                          start_timestamp=now,
                          end_timestamp=now + second_job_duration,
                          job_guid='a-different-unique-guid')
    jm.store_job_data([second_job])
    ingested_second_job = jm.get_job(2)[0]
    assert ingested_second_job['running_eta'] == first_job_duration

    # Check that the average duration is updated now that there are two jobs.
    call_command('calculate_durations')
    durations = JobDuration.objects.all()
    assert len(durations) == 1
    expected_duration = int(round((first_job_duration + second_job_duration) / 2))
    assert durations[0].average_duration == expected_duration


def test_cycle_all_data(jm, sample_data,
                        sample_resultset, test_repository, mock_log_parser,
                        elasticsearch, failure_lines):
    """
    Test cycling the sample data
    """
    from treeherder.model.search import connection
    connection.indices.delete(TestFailureLine._doc_type.index)
    refresh_all()
    assert TestFailureLine.search().params(search_type="count").execute().hits.total == 2
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    refresh_all()
    assert TestFailureLine.search().params(search_type="count").execute().hits.total == 2
    time_now = time.time()
    cycle_date_ts = time_now - 7 * 24 * 3600

    jm.execute(
        proc="jobs_test.updates.set_jobs_last_modified",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_jobs_for_cycling",
        placeholders=[time_now - 24 * 3600]
    )

    jobs_before = jm.execute(proc="jobs_test.selects.jobs")

    refresh_all()
    assert TestFailureLine.search().params(search_type="count").execute().hits.total == 2
    call_command('cycle_data', sleep_time=0, days=1)

    refresh_all()

    jobs_after = jm.execute(proc="jobs_test.selects.jobs")

    assert len(jobs_after) == len(jobs_before) - len(jobs_to_be_deleted)

    # There should be no jobs or failure lines after cycling
    assert len(jobs_after) == 0
    assert FailureLine.objects.count() == 0
    assert Job.objects.count() == 0
    assert JobDetail.objects.count() == 0

    # There should be nothing in elastic search after cycling
    for item in TestFailureLine.search().execute():
        print item.meta.id
    assert TestFailureLine.search().params(search_type="count").execute().hits.total == 0


def test_cycle_one_job(jm, sample_data,
                       sample_resultset, test_repository, mock_log_parser,
                       elasticsearch, failure_lines):
    """
    Test cycling one job in a group of jobs to confirm there are no
    unexpected deletions
    """

    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    job_not_deleted = jm.get_job(2)[0]

    extra_objects = {
        'failure_lines': (FailureLine,
                          create_failure_lines(test_repository,
                                               job_not_deleted["job_guid"],
                                               [(test_line, {}),
                                                (test_line, {"subtest": "subtest2"})])),
        'job_details': (JobDetail, [JobDetail.objects.create(
            job=Job.objects.get(guid=job_not_deleted["job_guid"]),
            title='test',
            value='testvalue')])
    }

    time_now = time.time()
    cycle_date_ts = int(time_now - 7 * 24 * 3600)

    jm.execute(
        proc="jobs_test.updates.set_jobs_last_modified",
        placeholders=[time_now]
    )

    jm.execute(
        proc="jobs_test.updates.set_one_job_last_modified_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_one_job_for_cycling",
        placeholders=[1]
    )

    jobs_before = jm.execute(proc="jobs_test.selects.jobs")

    call_command('cycle_data', sleep_time=0, days=1, debug=True)
    refresh_all()

    jobs_after = jm.execute(proc="jobs_test.selects.jobs")

    # Confirm that the target result set has no jobs in the
    # jobs table
    jobs_to_be_deleted_after = jm.execute(
        proc="jobs_test.selects.get_one_job_for_cycling",
        placeholders=[1]
    )

    assert len(jobs_to_be_deleted_after) == 0

    assert len(jobs_after) == len(jobs_before) - len(jobs_to_be_deleted)
    assert len(jobs_after) == Job.objects.count()

    for (object_type, objects) in extra_objects.values():
        assert (set(item.id for item in object_type.objects.all()) ==
                set(item.id for item in objects))

    assert set(int(item.meta.id) for item in TestFailureLine.search().execute()) == set(item.id for item in extra_objects["failure_lines"][1])


def test_cycle_all_data_in_chunks(jm, sample_data,
                                  sample_resultset, test_repository, mock_log_parser):
    """
    Test cycling the sample data in chunks.
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    # build a date that will cause the data to be cycled
    time_now = time.time()
    cycle_date_ts = int(time_now - 7 * 24 * 3600)

    jm.execute(
        proc="jobs_test.updates.set_jobs_last_modified",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_jobs_for_cycling",
        placeholders=[time_now - 24 * 3600]
    )

    job = jm.get_job(jobs_to_be_deleted[0]['id'])[0]
    create_failure_lines(test_repository,
                         job["job_guid"],
                         [(test_line, {})] * 7)

    jobs_before = jm.execute(proc="jobs_test.selects.jobs")

    assert TestFailureLine.search().params(search_type="count").execute().hits.total > 0

    call_command('cycle_data', sleep_time=0, days=1, chunk_size=3)
    refresh_all()

    jobs_after = jm.execute(proc="jobs_test.selects.jobs")

    assert len(jobs_after) == len(jobs_before) - len(jobs_to_be_deleted)

    # There should be no jobs after cycling
    assert len(jobs_after) == 0
    assert Job.objects.count() == 0
    assert FailureLine.objects.count() == 0
    assert JobDetail.objects.count() == 0
    assert TestFailureLine.search().params(search_type="count").execute().hits.total == 0


def test_cycle_task_set_meta(jm):
    to_delete = TaskSetMeta(count=0)
    to_delete.save()
    to_keep = TaskSetMeta(count=1)
    to_keep.save()

    assert [item.id for item in TaskSetMeta.objects.all()] == [to_delete.id, to_keep.id]

    call_command('cycle_data', sleep_time=0, days=1, chunk_size=3)

    assert [item.id for item in TaskSetMeta.objects.all()] == [to_keep.id]


def test_cycle_job_model_reference_data(jm, sample_data, sample_resultset,
                                        test_repository, mock_log_parser):
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    # create a fake original runnable job, since we don't fetch those via
    # job ingestion
    RunnableJob.objects.create(build_platform=BuildPlatform.objects.all()[0],
                               machine_platform=MachinePlatform.objects.all()[0],
                               job_type=JobType.objects.all()[0],
                               option_collection_hash='test1',
                               ref_data_name='test1',
                               build_system_type='test1',
                               repository=test_repository)

    # get a list of ids of original reference data
    original_job_type_ids = JobType.objects.values_list('id', flat=True)
    original_job_group_ids = JobGroup.objects.values_list('id', flat=True)
    original_runnable_job_ids = RunnableJob.objects.values_list('id', flat=True)

    # create a bunch of job model data that should be cycled, since they don't
    # reference any current jobs
    jg = JobGroup.objects.create(symbol='moo', name='moo')
    jt = JobType.objects.create(job_group=jg, symbol='mu', name='mu')
    rj = RunnableJob.objects.create(build_platform=BuildPlatform.objects.all()[0],
                                    machine_platform=MachinePlatform.objects.all()[0],
                                    job_type=jt,
                                    option_collection_hash='test2',
                                    ref_data_name='test2',
                                    build_system_type='test2',
                                    repository=test_repository)
    (jg_id, jt_id, rj_id) = (jg.id, jt.id, rj.id)
    call_command('cycle_data', sleep_time=0, days=1, chunk_size=3)

    # assert that those jobs that should be cycled, are cycled
    assert JobGroup.objects.filter(id=jg_id).count() == 0
    assert JobType.objects.filter(id=jt_id).count() == 0
    assert RunnableJob.objects.filter(id=rj_id).count() == 0

    # assert that we still have everything that shouldn't have been cycled
    assert JobType.objects.filter(id__in=original_job_type_ids).count() == len(original_job_type_ids)
    assert JobGroup.objects.filter(id__in=original_job_group_ids).count() == len(original_job_group_ids)
    assert RunnableJob.objects.filter(id__in=original_runnable_job_ids).count() == len(original_runnable_job_ids)


def test_bad_date_value_ingestion(jm, test_repository, mock_log_parser):
    """
    Test ingesting an blob with bad date value

    """
    rs = result_set()
    blob = job_data(start_timestamp="foo",
                    revision=rs['revision'])

    jm.store_result_set_data([rs])
    jm.store_job_data([blob])
    # if no exception, we are good.


def test_store_result_set_data(jm, sample_resultset):

    data = jm.store_result_set_data(sample_resultset)

    result_set_ids = jm.get_dhub().execute(
        proc="jobs_test.selects.result_set_ids",
        key_column='long_revision',
        return_type='dict'
    )
    revision_ids = jm.get_dhub().execute(
        proc="jobs_test.selects.revision_ids",
        key_column='revision',
        return_type='dict'
    )

    rs_revisions = set()
    revisions = set()

    for datum in sample_resultset:
        rs_revisions.add(datum['revision'])
        for revision in datum['revisions']:
            revisions.add(revision['revision'])

    # Confirm all of the pushes and revisions in the
    # sample_resultset have been stored
    assert {r for r in data['result_set_ids'].keys() if len(r) == 40} == rs_revisions
    assert set(data['revision_ids'].keys()) == revisions

    # Confirm the data structures returned match what's stored in
    # the database
    for rev in rs_revisions:
        assert data['result_set_ids'][rev] == result_set_ids[rev]

    assert data['revision_ids'] == revision_ids


def test_store_result_set_revisions(jm, sample_resultset):
    """Test that the ``top`` revision stored for resultset is correct"""
    resultsets = sample_resultset[8:9]
    jm.store_result_set_data(resultsets)
    stored = jm.get_dhub().execute(proc="jobs_test.selects.result_sets")[0]
    assert stored["long_revision"] == "997b28cb87373456789012345678901234567890"
    assert stored["short_revision"] == "997b28cb8737"


def test_store_result_set_12_then_40(jm, sample_resultset):
    """Test that you can update a 12 char resultset to 40 and revisions"""
    long_resultset = sample_resultset[8]
    short_resultset = copy.deepcopy(long_resultset)
    short_resultset["revisions"] = []
    short_resultset["revision"] = short_resultset["revision"][:12]

    jm.store_result_set_data([short_resultset])
    # now update that short revision to a long revision
    jm.store_result_set_data([long_resultset])

    stored = jm.get_dhub().execute(proc="jobs_test.selects.result_sets")[0]
    revisions = jm.get_resultset_revisions_list(stored["id"])

    assert stored["long_revision"] == "997b28cb87373456789012345678901234567890"
    assert stored["short_revision"] == "997b28cb8737"
    assert len(revisions) > 0


def test_get_job_data(jm, test_project, sample_data,
                      sample_resultset, test_repository, mock_log_parser):

    target_len = 10
    job_data = sample_data.job_data[:target_len]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)

    with ArtifactsModel(test_project) as artifacts_model:
        job_data = artifacts_model.get_job_signatures_from_ids(range(1, 11))

    assert len(job_data) is target_len


def test_remove_existing_jobs_single_existing(jm, sample_data,
                                              sample_resultset, mock_log_parser):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)

    jl = jm.get_job_list(0, 10)

    data = jm._remove_existing_jobs(job_data)
    assert len(data) == 0
    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1

    assert Job.objects.count() == 1


def test_remove_existing_jobs_one_existing_one_new(jm, sample_data,
                                                   sample_resultset, mock_log_parser):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)

    data = jm._remove_existing_jobs(sample_data.job_data[:2])

    assert len(data) == 1
    assert Job.objects.count() == 1


def test_ingesting_skip_existing(jm, sample_data,
                                 sample_resultset, mock_log_parser):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)

    jm.store_job_data(sample_data.job_data[:2])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 2
    assert Job.objects.count() == 2


def test_ingest_job_with_updated_job_group(jm, sample_data, mock_log_parser,
                                           result_set_stored):
    """
    When a job_type is associated with a job group on data ingestion,
    that association will not updated ingesting a new job with the same
    job_type but different job_group
    """
    first_job = sample_data.job_data[0]
    first_job["job"]["group_name"] = "first group name"
    first_job["job"]["group_symbol"] = "1"
    first_job["revision"] = result_set_stored[0]["revision"]
    jm.store_job_data([first_job])

    second_job = copy.deepcopy(first_job)
    # create a new guid to ingest the job again
    second_job_guid = "a-unique-job-guid"
    second_job["job"]["job_guid"] = second_job_guid
    second_job["job"]["group_name"] = "second group name"
    second_job["job"]["group_symbol"] = "2"
    second_job["revision"] = result_set_stored[0]["revision"]

    jm.store_job_data([second_job])

    second_job_lookup = jm.get_job_ids_by_guid([second_job_guid])
    second_job_stored = jm.get_job(second_job_lookup[second_job_guid]["id"])

    first_job_group_name = first_job["job"]["group_name"]

    second_job_group_name = second_job_stored[0]["job_group_name"]

    assert first_job_group_name == second_job_group_name

    # make sure also we didn't create a new job group
    with pytest.raises(JobGroup.DoesNotExist):
        JobGroup.objects.get(name="second group name")


def test_ingest_job_with_revision_hash(jm, test_repository, sample_data,
                                       mock_log_parser, sample_resultset):
    """
    Test ingesting a job with only a revision hash, no revision.  And the
    revision_hash must NOT be the same SHA value as the top revision.

    This can happen if a user submits a new resultset in the API with their
    own revision_hash value.  If we just use the latest revision value, then
    their subsequent job submissions with the revision_hash they generated
    will fail and the jobs will be skipped.
    """
    revision_hash = "12345abc"
    resultset = sample_resultset[0].copy()
    resultset["revision_hash"] = revision_hash
    del resultset["revision"]
    jm.store_result_set_data([resultset])

    first_job = sample_data.job_data[0]
    first_job["revision_hash"] = revision_hash
    del first_job["revision"]
    jm.store_job_data([first_job])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1


def test_ingest_job_revision_and_revision_hash(jm, test_repository,
                                               sample_data, mock_log_parser,
                                               sample_resultset):

    # Given a resultset with a revision_hash value that is NOT the
    # top revision SHA, ingest a job with a different revision_hash, but a
    # matching revision SHA.  Ensure the job still goes to the right resultset.
    rs_revision_hash = "12345abc"
    resultset = sample_resultset[0].copy()
    resultset["revision_hash"] = rs_revision_hash
    revision = resultset["revision"]
    stored_resultsets = jm.store_result_set_data([resultset])

    first_job = sample_data.job_data[0]
    first_job["revision_hash"] = "abcdef123"
    first_job["revision"] = revision
    jm.store_job_data([first_job])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1
    assert jl[0]["result_set_id"] == stored_resultsets["inserted_result_set_ids"][0]


def test_ingest_job_revision_hash_blank_revision(jm, test_repository,
                                                 sample_data, mock_log_parser,
                                                 sample_resultset):

    # Given a resultset with a revision_hash value that is NOT the
    # top revision SHA, ingest a job with a different revision_hash, but a
    # matching revision SHA.  Ensure the job still goes to the right resultset.
    rs_revision_hash = "12345abc"
    resultset = sample_resultset[0].copy()
    resultset["revision_hash"] = rs_revision_hash
    stored_resultsets = jm.store_result_set_data([resultset])

    first_job = sample_data.job_data[0]
    first_job["revision_hash"] = rs_revision_hash
    first_job["revision"] = ""
    jm.store_job_data([first_job])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1
    assert jl[0]["result_set_id"] == stored_resultsets["inserted_result_set_ids"][0]

    assert Job.objects.count() == 1


def test_retry_on_operational_failure(jm, monkeypatch):
    """Test that we retry 20 times on operational failures"""
    from _mysql_exceptions import OperationalError
    from treeherder.model import utils
    from datasource.bases.SQLHub import SQLHub

    orig_retry_execute = utils.retry_execute
    retry_count = {'num': 0}

    def retry_execute_mock(dhub, logger, retries=0, **kwargs):
        retry_count['num'] = retries

        # if it goes beyond 20, we may be in an infinite retry loop
        assert retries <= 20
        return orig_retry_execute(dhub, logger, retries, **kwargs)

    monkeypatch.setattr(utils, "retry_execute", retry_execute_mock)

    def execute_mock(*args, **kwargs):
        raise OperationalError("got exception")

    monkeypatch.setattr(SQLHub, "execute", execute_mock)

    try:
        jm.get_job_list(0, 10)
    except OperationalError:
        assert True

    assert retry_count['num'] == 20


def test_delete_note(jm, eleven_jobs_stored):
    """
    test inserting and deleting a note
    """
    # create a failure classification corresponding to "not successful"
    FailureClassification.objects.create(id=2, name="fixed by commit")

    job = jm.get_job(1)[0]
    assert job["failure_classification_id"] == 1

    jm.insert_job_note(job["id"], 2, 'John Doe', 'A random note')

    job = jm.get_job(1)[0]
    assert job["failure_classification_id"] == 2
    notes = jm.get_job_note_list(job["id"])
    assert len(notes) == 1
    note = notes[0]

    jm.delete_job_note(job["id"], note["id"])
    job = jm.get_job(1)[0]
    assert job["failure_classification_id"] == 1
    assert len(jm.get_job_note_list(job["id"])) == 0
