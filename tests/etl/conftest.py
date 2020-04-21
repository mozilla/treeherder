import datetime

import pytest

from tests.test_utils import create_generic_job
from treeherder.model.models import Push


@pytest.fixture
def perf_push(test_repository):
    return Push.objects.create(
        repository=test_repository,
        revision='1234abcd',
        author='foo@bar.com',
        time=datetime.datetime.now(),
    )


@pytest.fixture
def perf_job(perf_push, failure_classifications, generic_reference_data):
    return create_generic_job(
        'myfunguid', perf_push.repository, perf_push.id, generic_reference_data
    )
