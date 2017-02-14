import pytest

from treeherder.seta.analyze_failures import get_failures_fixed_by_commit


@pytest.mark.django_db()
def test_analyze_failures(fifteen_jobs_with_notes, failures_fixed_by_commit):
    ret = get_failures_fixed_by_commit()
    exp = failures_fixed_by_commit

    assert sorted(ret.keys()) == sorted(exp.keys())

    for key in exp:
        assert sorted(ret[key]) == sorted(exp[key])
