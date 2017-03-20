import pytest

from treeherder.seta.high_value_jobs import get_high_value_jobs


@pytest.mark.django_db()
def test_get_high_value_jobs(fifteen_jobs_with_notes, failures_fixed_by_commit):
    get_high_value_jobs(failures_fixed_by_commit)
