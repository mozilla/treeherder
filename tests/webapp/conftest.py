import datetime
import json
import zlib

import pytest
from webtest.app import TestApp

from treeherder.config import wsgi
from treeherder.model.derived import ArtifactsModel
from treeherder.model.models import (Job,
                                     JobNote)


@pytest.fixture
def webapp():
    """
    we can use this object to test calls to a wsgi application
    """
    return TestApp(wsgi.application)


@pytest.fixture
def sample_artifacts(jm, sample_data):
    """provide 11 jobs with job artifacts."""

    jobs = sample_data.job_data[0:10]
    guid_list = [x["job"]["job_guid"] for x in jobs]
    job_id_lookup = jm.get_job_ids_by_guid(guid_list)
    artifact_placeholders = []

    for index, job in enumerate(jobs):
        job_id = job_id_lookup[job["job"]["job_guid"]]["id"]

        artifact_placeholders.append([
            job_id,
            "data_1",
            "json",
            zlib.compress(json.dumps({"data_1": "This is an artifact test"})),
            job_id,
            "data_1"
        ])

    with ArtifactsModel(jm.project) as artifacts_model:
        artifacts_model.store_job_artifact(artifact_placeholders)


@pytest.fixture
def sample_notes(jm, sample_data, eleven_jobs_stored, test_user,
                 failure_classifications, test_repository):
    """provide 11 jobs with job notes."""

    jobs = jm.get_job_list(0, 10)

    for ds_job in jobs:
        for fcid in [1, 2]:
            job = Job.objects.get(project_specific_id=ds_job['id'],
                                  repository=test_repository)
            JobNote.objects.create(job=job,
                                   failure_classification_id=fcid,
                                   user=test_user,
                                   text="you look like a man-o-lantern",
                                   timestamp=datetime.datetime.now())
