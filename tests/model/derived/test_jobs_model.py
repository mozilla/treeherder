import copy
import datetime
import time

import pytest
from django.core.management import call_command

from tests import test_utils
from tests.autoclassify.utils import (create_failure_lines,
                                      create_text_log_errors,
                                      test_line)
from tests.sample_data_generator import (job_data,
                                         result_set)
from treeherder.model.models import (Commit,
                                     ExclusionProfile,
                                     FailureLine,
                                     Job,
                                     JobDetail,
                                     JobDuration,
                                     JobExclusion,
                                     JobGroup,
                                     JobLog,
                                     JobType,
                                     Machine,
                                     Push,
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


def test_ingest_single_sample_job(jm, failure_classifications, sample_data,
                                  sample_resultset,
                                  mock_log_parser):
    """Process a single job structure in the job_data.txt file"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)


def test_ingest_all_sample_jobs(jm, failure_classifications, sample_data,
                                sample_resultset, mock_log_parser):
    """
    Process each job structure in the job_data.txt file and verify.
    """
    job_data = sample_data.job_data
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)


def test_ingest_twice_log_parsing_status_changed(jm,
                                                 failure_classifications,
                                                 sample_data,
                                                 sample_resultset,
                                                 mock_log_parser):
    """Process a single job twice, but change the log parsing status between,
    verify that nothing changes"""
    job_data = sample_data.job_data[:1]

    job_data[0]['job']['state'] = 'running'
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)
    assert JobLog.objects.count() == 1
    for job_log in JobLog.objects.all():
        job_log.update_status(JobLog.FAILED)

    job_data[0]['job']['state'] = 'completed'
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)
    assert JobLog.objects.count() == 1
    for job_log in JobLog.objects.all():
        job_log.status == JobLog.FAILED


def test_insert_result_sets(jm, sample_resultset, test_repository):

    slice_limit = 8
    sample_slice = sample_resultset[0:slice_limit]

    jm.store_result_set_data(sample_slice)

    assert Push.objects.count() == len(sample_slice)

    jm.store_result_set_data(sample_slice)

    # Confirm if we store the same data twice we don't identify new
    # result set ids
    assert Push.objects.count() == len(sample_slice)

    jm.store_result_set_data(sample_resultset)

    # Confirm if we store a mix of new result sets and already stored
    # result sets we store/identify the new ones
    assert Push.objects.count() == len(sample_resultset)


@pytest.mark.parametrize("same_ingestion_cycle", [False, True])
def test_ingest_running_to_retry_sample_job(jm, failure_classifications,
                                            sample_data,
                                            sample_resultset,
                                            mock_log_parser,
                                            same_ingestion_cycle):
    """Process a single job structure in the job_data.txt file"""
    jm.store_result_set_data(sample_resultset)

    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision'] = sample_resultset[0]['revision']
    job['state'] = 'running'
    job['result'] = 'unknown'

    def _simulate_retry_job(job):
        job['state'] = 'completed'
        job['result'] = 'retry'
        # convert the job_guid to what it would be on a retry
        job['job_guid'] = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]
        return job

    if same_ingestion_cycle:
        # now we simulate the complete version of the job coming in (on the
        # same push)
        new_job_datum = copy.deepcopy(job_data[0])
        new_job_datum['job'] = _simulate_retry_job(new_job_datum['job'])
        job_data.append(new_job_datum)
        jm.store_job_data(job_data)

        initial_job_id = jm.get_job_list(0, 1)[0]["id"]
    else:
        # store the job in the initial state
        jm.store_job_data(job_data)

        initial_job_id = jm.get_job_list(0, 1)[0]["id"]

        # now we simulate the complete version of the job coming in and
        # ingest a second time
        job = _simulate_retry_job(job)
        jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 10)

    assert len(jl) == 1
    assert jl[0]['result'] == 'retry'
    assert jl[0]['id'] == initial_job_id

    assert Job.objects.count() == 1
    assert JobLog.objects.count() == 1
    intermediary_job = Job.objects.all()[0]
    assert intermediary_job.project_specific_id == initial_job_id
    # intermediary guid should be the retry one
    assert intermediary_job.guid == job_data[-1]['job']['job_guid']


@pytest.mark.parametrize("ingestion_cycles", [[(0, 1), (1, 2), (2, 3)],
                                              [(0, 2), (2, 3)],
                                              [(0, 3)], [(0, 1), (1, 3)]])
def test_ingest_running_to_retry_to_success_sample_job(jm,
                                                       failure_classifications,
                                                       sample_data,
                                                       sample_resultset,
                                                       mock_log_parser,
                                                       ingestion_cycles):
    # verifies that retries to success work, no matter how jobs are batched
    jm.store_result_set_data(sample_resultset)

    job_datum = copy.deepcopy(sample_data.job_data[0])
    job_datum['revision'] = sample_resultset[0]['revision']

    job = job_datum['job']
    job_guid_root = job['job_guid']

    job_data = []
    for (state, result, job_guid) in [
            ('running', 'unknown', job_guid_root),
            ('completed', 'retry',
             job_guid_root + "_" + str(job['end_timestamp'])[-5:]),
            ('completed', 'success', job_guid_root)]:
        new_job_datum = copy.deepcopy(job_datum)
        new_job_datum['job']['state'] = state
        new_job_datum['job']['result'] = result
        new_job_datum['job']['job_guid'] = job_guid
        job_data.append(new_job_datum)

    for (i, j) in ingestion_cycles:
        jm.store_job_data(job_data[i:j])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 2
    assert jl[0]['result'] == 'retry'
    assert jl[1]['result'] == 'success'

    assert Job.objects.count() == 2
    assert JobLog.objects.count() == 2
    assert set(Job.objects.values_list('id', flat=True)) == set([j['id'] for j in jl])


@pytest.mark.parametrize("ingestion_cycles", [[(0, 1), (1, 3), (3, 4)],
                                              [(0, 3), (3, 4)],
                                              [(0, 2), (2, 4)]])
def test_ingest_running_to_retry_to_success_sample_job_multiple_retries(
        jm, failure_classifications, sample_data, sample_resultset,
        mock_log_parser, ingestion_cycles):
    # this verifies that if we ingest multiple retries:
    # (1) nothing errors out
    # (2) we end up with three jobs (the original + 2 retry jobs)

    jm.store_result_set_data(sample_resultset)

    job_datum = copy.deepcopy(sample_data.job_data[0])
    job_datum['revision'] = sample_resultset[0]['revision']

    job = job_datum['job']
    job_guid_root = job['job_guid']

    job_data = []
    for (state, result, job_guid) in [
            ('running', 'unknown', job_guid_root),
            ('completed', 'retry',
             job_guid_root + "_" + str(job['end_timestamp'])[-5:]),
            ('completed', 'retry',
             job_guid_root + "_12345"),
            ('completed', 'success', job_guid_root)]:
        new_job_datum = copy.deepcopy(job_datum)
        new_job_datum['job']['state'] = state
        new_job_datum['job']['result'] = result
        new_job_datum['job']['job_guid'] = job_guid
        job_data.append(new_job_datum)

    for (i, j) in ingestion_cycles:
        ins = job_data[i:j]
        jm.store_job_data(ins)
        print Job.objects.all()
    print Job.objects.all()
    jl = jm.get_job_list(0, 10)
    assert len(jl) == 3
    assert jl[0]['result'] == 'retry'
    assert jl[1]['result'] == 'retry'
    assert jl[2]['result'] == 'success'

    assert Job.objects.count() == 3
    assert JobLog.objects.count() == 3
    assert set(Job.objects.values_list('id', flat=True)) == set([j['id'] for j in jl])


def test_ingest_retry_sample_job_no_running(jm, test_repository,
                                            failure_classifications,
                                            sample_data, sample_resultset,
                                            mock_log_parser):
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


def test_calculate_durations(jm, test_repository, failure_classifications,
                             mock_log_parser):
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


def test_cycle_all_data(jm, failure_classifications, sample_data,
                        sample_resultset, test_repository, mock_log_parser,
                        failure_lines):
    """
    Test cycling the sample data
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset, False)

    time_now = time.time()
    cycle_date_ts = time_now - 7 * 24 * 3600

    jm.execute(
        proc="jobs_test.updates.set_jobs_submit_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_jobs_for_cycling",
        placeholders=[time_now - 24 * 3600]
    )

    jobs_before = jm.execute(proc="jobs_test.selects.jobs")

    call_command('cycle_data', sleep_time=0, days=1)

    refresh_all()

    jobs_after = jm.execute(proc="jobs_test.selects.jobs")

    assert len(jobs_after) == len(jobs_before) - len(jobs_to_be_deleted)

    # There should be no jobs or failure lines after cycling
    assert len(jobs_after) == 0
    assert FailureLine.objects.count() == 0
    assert Job.objects.count() == 0
    assert JobDetail.objects.count() == 0
    assert JobLog.objects.count() == 0

    # There should be nothing in elastic search after cycling
    assert TestFailureLine.search().params(search_type="count").execute().hits.total == 0


def test_cycle_one_job(jm, failure_classifications, sample_data,
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
                          create_failure_lines(
                              Job.objects.get(guid=job_not_deleted["job_guid"]),
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
        proc="jobs_test.updates.set_jobs_submit_timestamp",
        placeholders=[time_now]
    )

    jm.execute(
        proc="jobs_test.updates.set_one_job_submit_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_one_job_for_cycling",
        placeholders=[1]
    )
    num_job_logs_to_be_deleted = JobLog.objects.filter(
        job__project_specific_id__in=[job['id'] for job in
                                      jobs_to_be_deleted]).count()

    jobs_before = jm.execute(proc="jobs_test.selects.jobs")
    job_logs_before = JobLog.objects.count()

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

    assert JobLog.objects.count() == (job_logs_before -
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
    time_now = time.time()
    cycle_date_ts = int(time_now - 7 * 24 * 3600)

    jm.execute(
        proc="jobs_test.updates.set_jobs_submit_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_jobs_for_cycling",
        placeholders=[time_now - 24 * 3600]
    )

    job = jm.get_job(jobs_to_be_deleted[0]['id'])[0]
    create_failure_lines(Job.objects.get(guid=job["job_guid"]),
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


def test_bad_date_value_ingestion(jm, failure_classifications, mock_log_parser):
    """
    Test ingesting an blob with bad date value

    """
    rs = result_set()
    blob = job_data(start_timestamp="foo",
                    revision=rs['revision'])

    jm.store_result_set_data([rs])
    jm.store_job_data([blob])
    # if no exception, we are good.


def test_store_result_set_data(jm, test_repository, sample_resultset):

    jm.store_result_set_data(sample_resultset)

    # Confirm all of the pushes and revisions in the
    # sample_resultset have been stored
    exp_push_revisions = set()
    exp_commit_revisions = set()
    for rs in sample_resultset:
        exp_push_revisions.add(rs['revision'])
        for rs_revision in rs['revisions']:
            exp_commit_revisions.add(rs_revision['revision'])

    assert set(Push.objects.values_list('revision', flat=True)) == exp_push_revisions
    assert set(Commit.objects.values_list('revision', flat=True)) == exp_commit_revisions

    # Confirm the data structures returned match what's stored in
    # the database
    for rs in sample_resultset:
        push = Push.objects.get(
            repository=test_repository,
            revision=rs['revision'],
            author=rs['author'],
            revision_hash=rs.get('revision_hash', rs['revision']),
            time=datetime.datetime.fromtimestamp(rs['push_timestamp']))
        for commit in rs['revisions']:
            assert Commit.objects.get(
                push=push,
                revision=commit['revision'],
                author=commit['author'],
                comments=commit['comment'])


def test_remove_existing_jobs_single_existing(jm, failure_classifications,
                                              sample_data, sample_resultset,
                                              mock_log_parser):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)

    jl = jm.get_job_list(0, 10)

    data = jm._remove_existing_jobs(job_data)
    assert len(data) == 0
    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1

    assert Job.objects.count() == 1


def test_remove_existing_jobs_one_existing_one_new(jm, failure_classifications,
                                                   sample_data,
                                                   sample_resultset,
                                                   mock_log_parser):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)

    data = jm._remove_existing_jobs(sample_data.job_data[:2])

    assert len(data) == 1
    assert Job.objects.count() == 1


def test_new_job_in_exclusion_profile(jm, failure_classifications, sample_data,
                                      sample_resultset, mock_log_parser,
                                      test_sheriff, test_project,
                                      result_set_stored):
    for job in sample_data.job_data[:2]:
        job["revision"] = result_set_stored[0]["revision"]

    job = sample_data.job_data[1]
    platform = job["job"]["machine_platform"]["platform"]
    arch = job["job"]["machine_platform"]["architecture"]

    job_exclusion = JobExclusion.objects.create(
        name="jobex",
        info={
            "platforms": ["{} ({})".format(platform, arch)],
            "repos": [test_project],
            "option_collections": ["opt"],
            "option_collection_hashes": ["102210fe594ee9b33d82058545b1ed14f4c8206e"],
            "job_types": ["B2G Emulator Image Build (B)"]},
        author=test_sheriff,
    )
    exclusion_profile = ExclusionProfile.objects.create(
        name="Tier-2",
        is_default=False,
        author=test_sheriff,
    )
    exclusion_profile.exclusions.add(job_exclusion)
    jm.store_job_data(sample_data.job_data[:2])
    obtained = jm.get_job_list(offset=0, limit=100, exclusion_profile="Tier-2")
    # We check all the jobs applying the exclusion profile
    # If we find the excluded job, there is a problem
    assert job['job']['job_guid'] not in [ob['job_guid'] for ob in obtained]
    lower_tier_signatures = jm._get_lower_tier_signatures()
    assert len(lower_tier_signatures) == 1
    assert lower_tier_signatures[0]['tier'] == 2


def test_ingesting_skip_existing(jm, failure_classifications, sample_data,
                                 sample_resultset, mock_log_parser):
    """Remove single existing job prior to loading"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)

    jm.store_job_data(sample_data.job_data[:2])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 2
    assert Job.objects.count() == 2


def test_ingest_job_with_updated_job_group(jm, failure_classifications,
                                           sample_data, mock_log_parser,
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


def test_ingest_job_with_revision_hash(jm, test_repository,
                                       failure_classifications, sample_data,
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
    jm.store_result_set_data([resultset])

    first_job = sample_data.job_data[0]
    first_job["revision_hash"] = revision_hash
    del first_job["revision"]
    jm.store_job_data([first_job])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1


def test_ingest_job_revision_and_revision_hash(jm, test_repository,
                                               failure_classifications,
                                               sample_data, mock_log_parser,
                                               sample_resultset):

    # Given a resultset with a revision_hash value that is NOT the
    # top revision SHA, ingest a job with a different revision_hash, but a
    # matching revision SHA.  Ensure the job still goes to the right resultset.
    rs_revision_hash = "12345abc"
    resultset = sample_resultset[0].copy()
    resultset["revision_hash"] = rs_revision_hash
    revision = resultset["revision"]
    jm.store_result_set_data([resultset])

    first_job = sample_data.job_data[0]
    first_job["revision_hash"] = "abcdef123"
    first_job["revision"] = revision
    jm.store_job_data([first_job])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1
    assert jl[0]["push_id"] == Push.objects.values_list(
        'id', flat=True).get(revision=revision)


def test_ingest_job_revision_hash_blank_revision(jm, test_repository,
                                                 failure_classifications,
                                                 sample_data, mock_log_parser,
                                                 sample_resultset):

    # Given a resultset with a revision_hash value that is NOT the
    # top revision SHA, ingest a job with a different revision_hash, but a
    # matching revision SHA.  Ensure the job still goes to the right resultset.
    rs_revision_hash = "12345abc"
    resultset = sample_resultset[0].copy()
    resultset["revision_hash"] = rs_revision_hash
    jm.store_result_set_data([resultset])

    first_job = sample_data.job_data[0]
    first_job["revision_hash"] = rs_revision_hash
    first_job["revision"] = ""
    jm.store_job_data([first_job])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1
    assert jl[0]["push_id"] == Push.objects.values_list(
        'id', flat=True).get(revision_hash=rs_revision_hash)

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


def test_update_autoclassification_bug(test_job, test_job_2,
                                       classified_failures):
    # Job 1 has two failure lines so nothing should be updated
    assert test_job.update_autoclassification_bug(1234) is None

    failure_lines = create_failure_lines(test_job_2,
                                         [(test_line, {})])
    failure_lines[0].best_classification = classified_failures[0]
    failure_lines[0].save()
    classified_failures[0].bug_number = None
    lines = [(item, {}) for item in FailureLine.objects.filter(job_guid=test_job_2.guid).values()]
    create_text_log_errors(test_job_2, lines)

    assert test_job_2.update_autoclassification_bug(1234) == classified_failures[0]
    classified_failures[0].refresh_from_db()
    assert classified_failures[0].bug_number == 1234
