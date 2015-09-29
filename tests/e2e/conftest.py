import os

import pytest
import simplejson as json
from django.template import (Context,
                             Template)

from tests import test_utils
from treeherder.client import TreeherderJobCollection

base_dir = os.path.dirname(__file__)


@pytest.fixture
def pending_jobs():
    """returns a list of buildapi pending jobs"""
    with open(os.path.join(base_dir, "pending.json")) as f:
        return json.loads(f.read())


@pytest.fixture
def running_jobs():
    """returns a list of buildapi running jobs"""
    with open(os.path.join(base_dir, "running.json")) as f:
        return json.loads(f.read())


@pytest.fixture
def completed_jobs(sample_data):
    """returns a list of buildapi completed jobs"""
    with open(os.path.join(base_dir, "finished.json")) as f:
        content = f.read()
        t = Template(content)
        c = Context({"base_dir": base_dir})
        return json.loads(t.render(c))


@pytest.fixture
def pending_jobs_stored(
        jm, pending_jobs, result_set_stored):
    """
    stores a list of buildapi pending jobs into the jobs store
    using BuildApiTreeHerderAdapter
    """

    pending_jobs.update(result_set_stored[0])

    tjc = TreeherderJobCollection()
    tj = tjc.get_job(pending_jobs)
    tjc.add(tj)

    test_utils.post_collection(jm.project, tjc)


@pytest.fixture
def running_jobs_stored(
        jm, running_jobs, result_set_stored):
    """
    stores a list of buildapi running jobs
    """
    running_jobs.update(result_set_stored[0])

    tjc = TreeherderJobCollection()
    tj = tjc.get_job(running_jobs)
    tjc.add(tj)

    test_utils.post_collection(jm.project, tjc)


@pytest.fixture
def completed_jobs_stored(
        jm, completed_jobs, result_set_stored, mock_post_json):
    """
    stores a list of buildapi completed jobs
    """
    completed_jobs['revision_hash'] = result_set_stored[0]['revision_hash']

    tjc = TreeherderJobCollection()
    tj = tjc.get_job(completed_jobs)
    tjc.add(tj)

    test_utils.post_collection(jm.project, tjc)
