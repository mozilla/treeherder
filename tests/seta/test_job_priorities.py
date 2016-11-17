import pytest

from treeherder.seta.job_priorities import _map


@pytest.mark.skip('It does not work')
def test_map_buildbot():
    _map(build_system='buildbot')


@pytest.mark.skip('It does not work')
def test_map_taskcluster():
    _map(build_system='taskcluster')


@pytest.mark.skip('It does not work')
def test_map_wrong():
    _map(build_system='wrong')
