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
def sample_artifacts(jm, sample_data):
    """provide 11 jobs with job artifacts."""

    jobs = sample_data.job_data[0:10]

    for index, job in enumerate(jobs):

        jobs[index]["job"]["artifacts"] = [{
            "name":"data_1",
            "type":"json",
            "blob":{"data_1":"This is an artifact test" }
            }]

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

