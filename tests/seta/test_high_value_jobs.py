from treeherder.seta.high_value_jobs import get_high_value_jobs


def test_get_high_value_jobs(failures_fixed_by_commit):
    get_high_value_jobs(failures_fixed_by_commit)
