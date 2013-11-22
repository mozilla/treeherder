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
def eleven_jobs_stored(jm, sample_data, sample_resultset):
    """stores a list of 11 job samples"""

    jm.store_result_set_data(sample_resultset)

    num_jobs = 11
    jobs = sample_data.job_data[0:num_jobs]

    max_index = len(sample_resultset) - 1
    resultset_index = 0

    blobs = []
    for index, blob in enumerate(jobs):

        if resultset_index > max_index:
            resultset_index = 0

        # Modify job structure to sync with the resultset sample data
        job_guid = blob['job']['job_guid']

        if 'sources' in blob:
            del blob['sources']

        blob['revision_hash'] = sample_resultset[resultset_index]['revision_hash']

        blobs.append(blob)

        resultset_index += 1

    jm.store_job_data(blobs)


@pytest.fixture
def eleven_jobs_processed(jm, mock_log_parser, eleven_jobs_stored):
    """stores and processes list of 11 job samples"""
    jm.process_objects(11, raise_errors=True)

@pytest.fixture
def sample_artifacts(jm, sample_data):
    """provide 11 jobs with job artifacts."""

    jobs = sample_data.job_data[0:10]

    for index, job in enumerate(jobs):

        jobs[index]["job"]["artifact"] = {
            "name":"data_1",
            "type":"json",
            "blob":{"data_1":"This is an artifact test" }
            }

    jm.load_job_data(jobs)

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
