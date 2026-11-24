import pytest

from tests.test_utils import create_generic_job
from treeherder.model.models import JobType


@pytest.mark.parametrize("job_type_name", ["Gecko Decision Task", "Decision Task (push)"])
def test_fetch_associated_decision_job(
    test_repository, push_stored, failure_classifications, generic_reference_data, job_type_name
):
    push_id = 1
    test_job = create_generic_job(f"{'a' * 40}/0", test_repository, push_id, generic_reference_data)
    decision_job = create_generic_job(
        f"{'b' * 40}/0", test_repository, push_id, generic_reference_data
    )
    decision_job.job_type = JobType.objects.create(name=job_type_name, symbol="D")
    decision_job.save()

    assert test_job.fetch_associated_decision_job() == decision_job
