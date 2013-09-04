import pytest
import simplejson as json

from ..sampledata import SampleData
from treeherder.model.derived import JobData


@pytest.fixture
def job_with_local_log(jm, initial_data):
    log = "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    sample_data = SampleData()
    url = "file://{0}".format(
        sample_data.get_log_path("{0}.txt.gz".format(log)))

    job = JobData(sample_data.job_data[0])

    # substitute the log url with a local url
    job['job']['log_references'][0]['url'] = url
    return job


def test_parse_log(jm, initial_data, job_with_local_log, sample_resultset):
    """
    check that at least 2 job_artifacts get inserted when running
    a parse_log task
    """

    jm.store_result_set_data(sample_resultset['revision_hash'],
                            sample_resultset['push_timestamp'],
                            sample_resultset['revisions'])

    job = job_with_local_log
    job['revision_hash'] = sample_resultset['revision_hash']
    jm.store_job_data(json.dumps(job), job['job']['job_guid'])
    jm.process_objects(1)

    job_id = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.row_by_guid",
        placeholders=[job['job']['job_guid']]
    )[0]['id']

    job_artifacts = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.job_artifact",
        placeholders=[job_id]
    )

    # we must have at least 2 artifacts: one for the log viewer and another one
    # for the job artifact panel
    assert len(job_artifacts) >= 2
