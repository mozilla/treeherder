import pytest
from mock import patch

from treeherder.seta.analyze_failures import get_failures_fixed_by_commit
from treeherder.seta.settings import SETA_FIXED_BY_COMMIT_REPOS


@pytest.mark.django_db()
def test_analyze_failures(fifteen_jobs_with_notes, failures_fixed_by_commit, test_repository):
    SETA_FIXED_BY_COMMIT_REPOS.append(test_repository.name)
    ret = get_failures_fixed_by_commit()
    exp = failures_fixed_by_commit

    assert sorted(ret.keys()) == sorted(exp.keys())

    for key in exp:
        assert sorted(ret[key]) == sorted(exp[key])
