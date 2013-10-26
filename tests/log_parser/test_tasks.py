import pytest
import simplejson as json
from mock import MagicMock

from ..sampledata import SampleData
from treeherder.model.derived import JobData
from treeherder.log_parser.parsers import ErrorParser


@pytest.fixture
def job_with_local_log(jm, initial_data):
    log = "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    sample_data = SampleData()
    url = "file://{0}".format(
        sample_data.get_log_path("{0}.txt.gz".format(log)))

    job = sample_data.job_data[0]

    # substitute the log url with a local url
    job['job']['log_references'][0]['url'] = url
    # make this a successful job, so no error log processing
    job['job']['result'] = "success"
    return job


def test_parse_log(jm, initial_data, job_with_local_log, sample_resultset, monkeypatch):
    """
    check that at least 2 job_artifacts get inserted when running
    a parse_log task
    """

    jm.store_result_set_data(sample_resultset)

    job = job_with_local_log
    job['revision_hash'] = sample_resultset[0]['revision_hash']

    mock_pl = MagicMock(name="parse_line")
    monkeypatch.setattr(ErrorParser, 'parse_line', mock_pl)

    job = job_with_local_log
    jm.store_job_data(json.dumps(job), job['job']['job_guid'])
    jm.process_objects(1, raise_errors=True)

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
    # since this was a success job, should not call the ErrorParser
    assert mock_pl.called is False
