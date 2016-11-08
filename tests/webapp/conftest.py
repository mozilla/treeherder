import pytest
from webtest.app import TestApp

from treeherder.config import wsgi
from treeherder.model.models import (Job,
                                     JobNote)


@pytest.fixture
def webapp():
    """
    we can use this object to test calls to a wsgi application
    """
    return TestApp(wsgi.application)


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
                                   text="you look like a man-o-lantern")
