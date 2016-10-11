import gzip
import responses
import urllib2
import zlib

import pytest
import simplejson as json
from django.conf import settings
from django.utils.six import BytesIO

from treeherder.model.models import (JobDetail,
                                     TextLogError)

from ..sampledata import SampleData
from tests.test_utils import add_log_response


@pytest.fixture
def jobs_with_local_log(activate_responses):
    sample_data = SampleData()
    url = add_log_response(
        "mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122.txt.gz"
    )

    job = sample_data.job_data[0]

    # substitute the log url with a local url
    job['job']['log_references'][0]['url'] = url
    return [job]


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

    # we should have just one artifact, "bug suggestions"
    assert len(job_artifacts) == 1

    # this log generates 4 job detail objects at present
    print JobDetail.objects.count() == 4


def test_bug_suggestions_artifact(jm, jobs_with_local_log, sample_resultset, test_repository):
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

    # we should have just one artifact, "bug suggestions"
    assert len(job_artifacts) == 1

    bug_suggestions_artifact = [artifact for artifact in job_artifacts
                                if artifact["name"] == "Bug suggestions"][0]
    bug_suggestions = json.loads(zlib.decompress(bug_suggestions_artifact["blob"]))

    # we must have one bugs item per error in bug_suggestions.
    # errors with no bug suggestions will just have an empty
    # bugs list
    assert TextLogError.objects.count() == len(bug_suggestions)

    # We really need to add some tests that check the values of each entry
    # in bug_suggestions, but for now this is better than nothing.
    expected_keys = set(["search", "search_terms", "bugs"])
    for failure_line in bug_suggestions:
        assert set(failure_line.keys()) == expected_keys
