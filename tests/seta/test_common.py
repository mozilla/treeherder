import pytest

from treeherder.seta.common import job_priority_index


def test_job_priority_index(job_priority_list):
    result_jp_index = job_priority_index(job_priorities=job_priority_list)

    expected_jp_index = {
        ('reftest-e10s-1', 'opt', 'linux32'): {
            'pk': None,
            'build_system_type': '*'
        },
        ('reftest-e10s-2', 'opt', 'linux64'): {
            'pk': None,
            'build_system_type': 'taskcluster'
        },
        ('web-platform-tests-1', 'debug', 'windows8-64'): {
            'pk': None,
            'build_system_type': 'buildbot'
        }
    }
    assert result_jp_index == expected_jp_index


def test_job_priority_index_raises_if_duplicate_unique_id(job_priority_list):
    job_priority_list_with_dupes = job_priority_list + job_priority_list

    with pytest.raises(ValueError) as exc:
        job_priority_index(job_priorities=job_priority_list_with_dupes)

    exc.match(
        r'"(.+)" should be a unique job priority and that is unexpected.'
    )
