import pytest

from treeherder.seta.analyze_failures import get_failures_fixed_by_commit


@pytest.mark.django_db()
def test_analyze_failures(eleven_jobs_with_notes, failures_fixed_by_commit):
    assert get_failures_fixed_by_commit() == failures_fixed_by_commit
