import gzip
import urllib2

import pytest
from django.conf import settings
from django.utils.six import BytesIO

from treeherder.model.error_summary import get_error_summary
from treeherder.model.models import (Job,
                                     JobDetail,
                                     TextLogError)

from ..sampledata import SampleData


@pytest.fixture
def jobs_with_local_log():
    log = ("mozilla-inbound_ubuntu64_vm-debug_test-"
           "mochitest-other-bm53-tests1-linux-build122")
    sample_data = SampleData()
    url = "file://{0}".format(
        sample_data.get_log_path("{0}.txt.gz".format(log)))

    job = sample_data.job_data[0]

    # substitute the log url with a local url
    job['job']['log_references'][0]['url'] = url
    return [job]


@pytest.fixture
def jobs_with_local_mozlog_log():
    log = ("plain-chunked_raw.log")
    sample_data = SampleData()
    url = "file://{0}".format(
        sample_data.get_log_path("{0}.gz".format(log)))

    # sample url to test with a real log, during development
    # url = "http://mozilla-releng-blobs.s3.amazonaws.com/blobs/try/sha512/6a690d565effa5a485a9385cc62eccd59feaa93fa6bb167073f012a105dc33aeaa02233daf081426b5363cd9affd007e42aea2265f47ddbc334a4493de1879b5"
    job = sample_data.job_data[0]

    # substitute the log url with a local url
    job['job']['log_references'][0]['url'] = url
    job['job']['log_references'][0]['name'] = 'mozlog_json'
    return [job]


@pytest.fixture
def mock_mozlog_get_log_handler(monkeypatch):

    def _get_log_handle(mockself, url):
        response = urllib2.urlopen(
               url,
               timeout=settings.REQUESTS_TIMEOUT
        )
        return gzip.GzipFile(fileobj=BytesIO(response.read()))

    import treeherder.etl.common
    monkeypatch.setattr(treeherder.log_parser.artifactbuilders.MozlogArtifactBuilder,
                        'get_log_handle', _get_log_handle)


def test_parse_log(jm, jobs_with_local_log, sample_resultset):
    """
    check that 2 job_artifacts get inserted when running a parse_log task for
    a successful job and that JobDetail objects get created
    """

    jm.store_result_set_data(sample_resultset)

    jobs = jobs_with_local_log
    for job in jobs:
        # make this a successful job, to check it's still parsed for errors
        job['job']['result'] = "success"
        job['revision'] = sample_resultset[0]['revision']

    jm.store_job_data(jobs)

    job_id = jm.get_dhub().execute(
        proc="jobs_test.selects.row_by_guid",
        placeholders=[jobs[0]['job']['job_guid']]
    )[0]['id']

    job_artifacts = jm.get_dhub().execute(
        proc="jobs_test.selects.job_artifact",
        placeholders=[job_id]
    )

    # should no longer be generating any job artifacts
    assert len(job_artifacts) == 0

    # this log generates 4 job detail objects at present
    print JobDetail.objects.count() == 4


def test_create_error_summary(jm, jobs_with_local_log, sample_resultset,
                              test_repository):
    """
    check that a bug suggestions artifact gets inserted when running
    a parse_log task for a failed job, and that the number of
    bug search terms/suggestions matches the number of error lines.
    """
    jm.store_result_set_data(sample_resultset)

    jobs = jobs_with_local_log
    for job in jobs:
        job['job']['result'] = "testfailed"
        job['revision'] = sample_resultset[0]['revision']

    jm.store_job_data(jobs)

    job_id = jm.get_dhub().execute(
        proc="jobs_test.selects.row_by_guid",
        placeholders=[jobs[0]['job']['job_guid']]
    )[0]['id']

    job_artifacts = jm.get_dhub().execute(
        proc="jobs_test.selects.job_artifact",
        placeholders=[job_id]
    )

    bug_suggestions = get_error_summary(Job.objects.get(id=1))

    # should no longer have any bug suggestions artifacts
    assert len(job_artifacts) == 0

    # we must have one bugs item per error in bug_suggestions.
    # errors with no bug suggestions will just have an empty
    # bugs list
    assert TextLogError.objects.count() == len(bug_suggestions)

    # We really need to add some tests that check the values of each entry
    # in bug_suggestions, but for now this is better than nothing.
    expected_keys = set(["search", "search_terms", "bugs"])
    for failure_line in bug_suggestions:
        assert set(failure_line.keys()) == expected_keys
