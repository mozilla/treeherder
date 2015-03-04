# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
import simplejson as json

from ..sampledata import SampleData


@pytest.fixture
def jobs_with_local_log(initial_data):
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
def jobs_with_local_talos_log(initial_data):
    sample_data = SampleData()
    url = sample_data.get_performance_logs()[0]

    job = sample_data.job_data[0]

    # substitute the log url with a local url
    job['job']['log_references'][0]['url'] = url
    return [job]


def test_parse_log(jm, initial_data, jobs_with_local_log, sample_resultset,
                   mock_send_request, mock_get_remote_content):
    """
    check that at least 3 job_artifacts get inserted when running
    a parse_log task for a successful job
    """

    jm.store_result_set_data(sample_resultset)

    jobs = jobs_with_local_log
    for job in jobs:
        # make this a successful job, to check it's still parsed for errors
        job['job']['result'] = "success"
        job['revision_hash'] = sample_resultset[0]['revision_hash']

    jm.store_job_data(jobs)
    jm.process_objects(1, raise_errors=True)

    job_id = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.row_by_guid",
        placeholders=[jobs[0]['job']['job_guid']]
    )[0]['id']

    job_artifacts = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.job_artifact",
        placeholders=[job_id]
    )

    jm.disconnect()

    # we must have at least 3 artifacts:
    # 1 for the log viewer
    # 1 for the job artifact panel
    # 1 for the bug suggestions
    assert len(job_artifacts) >= 3


def test_parse_talos_log(jm, initial_data, jobs_with_local_talos_log, sample_resultset,
                         mock_send_request, mock_get_remote_content):
    """
    check that performance job_artifacts get inserted when running
    a parse_log task for a talos job
    """

    jm.store_result_set_data(sample_resultset)

    jobs = jobs_with_local_talos_log
    jm.store_job_data(jobs)
    jm.process_objects(1, raise_errors=True)

    artifact_list = jm.get_performance_artifact_list(0, 10)
    assert len(artifact_list) >= 1  # should parse out at least one perf artifact


def test_bug_suggestions_artifact(jm, initial_data, jobs_with_local_log,
                                  sample_resultset, mock_send_request,
                                  mock_get_remote_content
                                  ):
    """
    check that at least 3 job_artifacts get inserted when running
    a parse_log task for a failed job, and that the number of
    bug search terms/suggestions matches the number of error lines.
    """
    jm.store_result_set_data(sample_resultset)

    jobs = jobs_with_local_log
    for job in jobs:
        job['job']['result'] = "testfailed"
        job['revision_hash'] = sample_resultset[0]['revision_hash']

    jm.store_job_data(jobs)
    jm.process_objects(1, raise_errors=True)

    job_id = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.row_by_guid",
        placeholders=[jobs[0]['job']['job_guid']]
    )[0]['id']

    job_artifacts = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.job_artifact",
        placeholders=[job_id]
    )

    jm.disconnect()

    # we must have at least 3 artifacts:
    # 1 for the log viewer
    # 1 for the job artifact panel
    # 1 for the bug suggestions
    assert len(job_artifacts) >= 3

    structured_log_artifact = [artifact for artifact in job_artifacts
                               if artifact["name"] == "text_log_summary"][0]
    bug_suggestions_artifact = [artifact for artifact in job_artifacts
                                if artifact["name"] == "Bug suggestions"][0]
    structured_log = json.loads(structured_log_artifact["blob"])

    all_errors = structured_log["step_data"]["all_errors"]
    bug_suggestions = json.loads(bug_suggestions_artifact["blob"])

    # we must have one bugs item per error in bug_suggestions.
    # errors with no bug suggestions will just have an empty
    # bugs list
    assert len(all_errors) == len(bug_suggestions)
