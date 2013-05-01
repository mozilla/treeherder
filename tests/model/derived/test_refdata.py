import os
import time
import urllib2

import pytest
from mock import Mock
from django.core.management import call_command
from django.conf import settings
from django.db import connection

from datasource.bases.BaseHub import BaseHub
from treeherder.model.models import (RepositoryGroup,
                                     Repository, RepositoryVersion)


@pytest.fixture
def mock_urllib():
    mock = Mock()
    mock.return_value = (
        '#just comments',
        'latest version'
    )
    urllib2.urlopen = mock


@pytest.fixture()
def refdata():
    """returns a patched RefDataManager for testing purpose"""

    import os
    from treeherder.model.derived import RefDataManager
    from tests.conftest import add_test_procs_file

    refdata = RefDataManager()

    proc_path = os.path.join(
        os.path.abspath(os.path.dirname(__file__)),
        'test_refdata.json'
    )

    add_test_procs_file(refdata.dhub, 'reference', proc_path)
    return refdata


@pytest.fixture
def repository_id():
    repo_group = RepositoryGroup.objects.create(name='mygroup')
    repo_args = {
        "dvcs_type": "hg",
        "name": "mozilla-central",
        "url": "https://hg.mozilla.org/mozilla-central",
        "active_status": "active",
        "codebase": "gecko",
        "repository_group": repo_group,
        "description": ""
    }
    repo = Repository.objects.create(**repo_args)
    return repo.id


@pytest.fixture
def old_version_repository(repository_id):
    version = RepositoryVersion.objects.create(repository_id=repository_id,
                                               version='1.0',
                                               version_timestamp=time.time())
    return repository_id, version.id


@pytest.fixture
def latest_version_repository(repository_id):
    version = RepositoryVersion.objects.create(repository_id=repository_id,
                                               version='latest version',
                                               version_timestamp=time.time())
    return repository_id, version.id


test_params = [
    {
        'func': 'get_or_create_build_platform',
        'input': ['linux', 'Fedora 12', 'x86_64'],
        'test_proc': 'test_refdata.selects.test_build_platform',
        'expected': [{
            'os_name': 'linux',
            'platform': 'Fedora 12',
            'architecture': 'x86_64',
            'active_status': 'active'
        }]
    },
    {
        'func': 'get_or_create_job_group',
        'input': ['mygroup'],
        'test_proc': 'test_refdata.selects.test_job_group',
        'expected': [{
            'symbol': '?',
            'name': 'mygroup',
            'description': 'fill me',
            'active_status': 'active'
        }]
    },
    {
        'input': ['myname', 'mygroup'],
        'func': 'get_or_create_job_type',
        'test_proc': 'test_refdata.selects.test_job_type',
        'expected': [{
            'symbol': '?',
            'name': 'myname',
            'group': 'mygroup',
            'description': 'fill me',
            'active_status': 'active'
        }]
    },
    {
        'input': ['myname', 1366290144.07455],
        'func': 'get_or_create_machine',
        'test_proc': 'test_refdata.selects.test_machine',
        'expected': [{
            'name': 'myname',
            'first_timestamp': 1366290144,
            'last_timestamp': 1366290144,
            'active_status': 'active'
        }]
    },
    {
        'func': 'get_or_create_machine_platform',
        'input': ['linux', 'Fedora 12', 'x86_64'],
        'test_proc': 'test_refdata.selects.test_machine_platform',
        'expected': [{
            'os_name': 'linux',
            'platform': 'Fedora 12',
            'architecture': 'x86_64',
            'active_status': 'active'
        }]
    },
    {
        'func': 'get_or_create_option',
        'input': ['myoption'],
        'test_proc': 'test_refdata.selects.test_option',
        'expected': [{
            'name': 'myoption',
            'description': 'fill me',
            'active_status': 'active'
        }]
    },
    {
        'func': 'get_or_create_option_collection',
        'input': [['option1', 'option2']],
        'test_proc': 'test_refdata.selects.test_option_collection',
        'expected': [{'name': 'option1'}, {'name': 'option2'}]
    },
    {
        'func': 'get_or_create_product',
        'input': ['myproduct'],
        'test_proc': 'test_refdata.selects.test_product',
        'expected': [{
            'name': 'myproduct',
            'description': 'fill me',
            'active_status': 'active'
        }]
    }

]


@pytest.mark.parametrize(("params"), test_params)
def test_refdata_manager(refdata, params):
    """test get_or_create methods produce the right content"""

    #call the right refdata method based on params
    id = getattr(refdata, params['func'])(*params['input'])

    row_data = refdata.dhub.execute(
        proc=params["test_proc"],
        placeholders=[id]
    )
    for i, row in enumerate(row_data):
        for k, v in params['expected'][i].items():
            assert row[k] == v


# some tests don't fit into a standard layout :(


def test_get_or_create_repository_version(refdata, repository_id):

    id = refdata.get_or_create_repository_version(
        repository_id, 'v1.0', 1367248930.235682)

    row_data = refdata.dhub.execute(
        proc='test_refdata.selects.test_repository_version',
        placeholders=[id],
        return_type='iter'
    )

    assert row_data.get_column_data('repository_id') == repository_id
    assert row_data.get_column_data('version') == 'v1.0'
    assert row_data.get_column_data('version_timestamp') == 1367248930
    assert row_data.get_column_data('active_status') == 'active'


def test_get_repository_info(refdata, repository_id):
    """test get_repository_info retrieves the right informations"""

    info = refdata.get_repository_info(repository_id)

    expected = {
        "dvcs_type": "hg",
        "name": "mozilla-central",
        "url": "https://hg.mozilla.org/mozilla-central",
        "active_status": "active",
        "codebase": "gecko",
        "repository_group_id": 1,
        "description": ""
    }
    for k, v in expected.items():
        assert info[k] == v


def test_get_hg_repository_version(refdata, mock_urllib):
    version = refdata.get_hg_repository_version("https://hg.mozilla.org/mozilla-central")
    assert version == 'latest version'


def test_update_repo_version_if_old(refdata, old_version_repository, mock_urllib):
    """test repo version is updated if a new one is available"""

    time_now = time.time()
    repo_id, old_version = old_version_repository

    refdata.update_repository_version(repo_id)

    updated_version = refdata.get_repository_version_id(repo_id)

    assert old_version != updated_version


def test_update_repo_version_unchanged(refdata, latest_version_repository, mock_urllib):
    """test version is kept and version_timestamp is updated
    if the version has not changed"""

    time_now = time.time()
    repo_id, last_version = latest_version_repository
    refdata.update_repository_version(repo_id)

    updated_version = refdata.get_repository_version_id(repo_id)

    row_data = refdata.dhub.execute(
        proc='test_refdata.selects.test_repository_version',
        placeholders=[updated_version],
        return_type='iter'
    )

    assert row_data.get_column_data('version') == 'latest version'
    assert row_data.get_column_data('version_timestamp') >= long(time_now)


def test_update_repo_version_command(refdata, old_version_repository, initial_data, mock_urllib):
    """Test the django command extension update_repository_version"""

    repo_id, old_version = old_version_repository

    call_command('update_repository_version')

    updated_version = refdata.get_repository_version_id(repo_id)

    assert old_version != updated_version
