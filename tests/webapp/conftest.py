import json
import os
from treeherder.webapp import wsgi
from tests.sample_data_generator import job_data
import pytest
from webtest.app import TestApp


@pytest.fixture
def webapp():
    """
    we can use this object to test calls to a wsgi application
    """
    return TestApp(wsgi.application)


@pytest.fixture
def job_sample():
    return job_data()


@pytest.fixture
def pushlog_sample(test_base_dir):
    resultset_file = os.path.join(
        test_base_dir,
        'sample_data',
        'resultset_data.json',
    )
    data = None
    with open(resultset_file) as f:
        data = json.loads(f.read())
    return data

@pytest.fixture
def eleven_jobs_stored(jm, initial_data):
    """stores a list of 11 job samples"""
    num_jobs = 11
    guids = ['myguid%s' % x for x in range(1, num_jobs + 1)]

    rh = 0
    pt = 0
    for guid in guids:
        # this is to store the job resultset.
        job = job_data(job_guid=guid)
        job["revision_hash"] = rh
        del job["job"]["log_references"][0]

        jm.store_result_set_data(
            rh,
            pt,
            [{
                "revision": "d62d628d5308f2b9ee81be755140d77f566bb4{0}".format(rh),
                "files": [
                    "file1",
                    "file2",
                    "file3"
                ],
                "author": "Mauro Doglio <mdoglio@mozilla.com>",
                "branch": "default",
                "comments":" Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                "repository": "mozilla-aurora",
                "commit_timestamp": "1370459745"
            }])

        # now we can store the job data safely
        jm.store_job_data(
            json.dumps(job),
            guid
        )
        pt += 1
        rh += 1


@pytest.fixture
def eleven_jobs_processed(jm, eleven_jobs_stored):
    """stores and processes list of 11 job samples"""
    jm.process_objects(11, raise_errors=True)

@pytest.fixture
def sample_artifacts(jm, sample_data, eleven_jobs_processed):
    """provide 11 jobs with job artifacts."""

    jobs = jm.get_job_list(0, 10)

    for job in jobs:
        jm.insert_job_artifact(
            job["id"],
            "Foo Job Artifact",
            "json",
            json.dumps(sample_data.job_artifact)
        )

@pytest.fixture
def sample_notes(jm, sample_data, eleven_jobs_processed):
    """provide 11 jobs with job notes."""

    jobs = jm.get_job_list(0, 10)

    for job in jobs:
        for fcid in [0, 1]:
            jm.insert_job_note(
                job["id"],
                fcid,
                "kellyclarkson",
                "you look like a man-o-lantern"
            )
