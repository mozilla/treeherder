from django.utils import timezone
import pytest

from treeherder.seta.models import TaskRequest

slow = pytest.mark.slow


@slow
def test_create_instance(test_repository):
    TaskRequest.objects.create(repository=test_repository,
                               counter=0,
                               last_request=timezone.now(),
                               reset_delta=0)
