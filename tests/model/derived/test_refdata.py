import os
import time
import urllib2
import json

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
    """this mocks urllib to avoid hitting the network
    when retrieving the hg version file"""
    mock = Mock()
    mock.return_value = (
        '#just comments',
        'latest version'
    )
    urllib2.urlopen = mock

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

time_now = int( time.time() )
test_params = [
    {
        'func': 'get_or_create_build_platforms',

        'input': [
            ['linux', 'Fedora 12', 'x86_64'],
            #Duplicate input to test aggregation
            ['linux', 'Fedora 12', 'x86_64'],
            ['linux', 'Fedora 13', 'x86_64'],
            ['linux', 'Fedora 14', 'x86'],
            ],

        'expected': {
            'linux-Fedora 12-x86_64':{
                'id':1, 'os_name':'linux', 'platform': 'Fedora 12',
                'architecture':'x86_64',
                },
            'linux-Fedora 13-x86_64':{
                'id':2, 'os_name':'linux', 'platform': 'Fedora 13',
                'architecture':'x86_64',
                },
            'linux-Fedora 14-x86':{
                'id':3, 'os_name':'linux', 'platform': 'Fedora 14',
                'architecture':'x86',
                },
        }
    },
    {
        'func': 'get_or_create_job_groups',
        'input': [
            #Duplicate group to test aggregation
            'mygroup1', 'mygroup2', 'mygroup3', 'mygroup4', 'mygroup4'
            ],
        'expected': {
            'mygroup1':{'id':1, 'name':'mygroup1'},
            'mygroup2':{'id':2, 'name':'mygroup2'},
            'mygroup3':{'id':3, 'name':'mygroup3'},
            'mygroup4':{'id':4, 'name':'mygroup4'},
            }
    },
    {
        'func': 'get_or_create_job_types',
        #Duplicate type to test aggregation
        'input': ['mytype1', 'mytype2', 'mytype3', 'mytype4', 'mytype4'],
        'expected': {
            'mytype1':{'id':1, 'name':'mytype1'},
            'mytype2':{'id':2, 'name':'mytype2'},
            'mytype3':{'id':3, 'name':'mytype3'},
            'mytype4':{'id':4, 'name':'mytype4'},
            }
    },
    {
        'func': 'get_or_create_machines',
        'input': [
            ['machine1', time_now],
            ['machine2', time_now],
            ['machine3', time_now],
            ['machine4', time_now],
            ['machine4', time_now]
            ],
        'expected': {
            'machine1':{'id':1, 'name':'machine1'},
            'machine2':{'id':2, 'name':'machine2'},
            'machine3':{'id':3, 'name':'machine3'},
            'machine4':{'id':4, 'name':'machine4'},
            }
    },
    {
        'func': 'get_or_create_machine_platforms',

        'input': [
            ['linux', 'Fedora 12', 'x86_64'],
            ['linux', 'Fedora 13', 'x86_64'],
            ['linux', 'Fedora 14', 'x86'],
            ],

        'expected': {
            'linux-Fedora 12-x86_64':{
                'id':1, 'os_name':'linux', 'platform': 'Fedora 12',
                'architecture':'x86_64',
                },
            'linux-Fedora 13-x86_64':{
                'id':2, 'os_name':'linux', 'platform': 'Fedora 13',
                'architecture':'x86_64',
                },
            'linux-Fedora 14-x86':{
                'id':3, 'os_name':'linux', 'platform': 'Fedora 14',
                'architecture':'x86',
                },
        }
    },
    {
        'func': 'get_or_create_option_collection',
        'input': [
            ['option1', 'option2'],
            ['option3', 'option4', 'option5'],
            ['option1', 'option2'],
            ['option2', 'option5'],
            ],
        'expected': {
            '14e81a0976d78ebd9e6a8c140dd31ce109393972': [
                'option1', 'option2'
                ],
            '56b4b90c6b25d206a113dccdcd777311503ab672': [
                'option3', 'option4', 'option5'
                ],
            '5ec4709b5c552e335f9570369d15cc62b5ef18b3': [
                'option2', 'option5'
                ]
            }
    },
    {

        'func': 'get_or_create_products',
        'input': [
            'product1', 'product2', 'product3', 'product4', 'product4'
            ],
        'expected': {
            'product1':{'id':1, 'name':'product1'},
            'product2':{'id':2, 'name':'product2'},
            'product3':{'id':3, 'name':'product3'},
            'product4':{'id':4, 'name':'product4'},
            }
    }

]


@pytest.mark.parametrize(("params"), test_params)
def test_refdata_manager(refdata, params):
    """test get_or_create methods produce the right content"""

    expected = getattr(refdata, params['func'])(params['input'])
    assert expected == params['expected']


# some tests don't fit into a standard layout :(


def test_get_or_create_repository_version(refdata, repository_id):

    id = refdata.get_or_create_repository_version(
        repository_id, 'v1.0', 1367248930.235682)

    row_data = refdata.dhub.execute(
        proc='refdata_test.selects.test_repository_version',
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
        proc='refdata_test.selects.test_repository_version',
        placeholders=[updated_version],
        return_type='iter'
    )

    assert row_data.get_column_data('version') == 'latest version'
    assert row_data.get_column_data('version_timestamp') >= long(time_now)


def test_update_repo_version_command(refdata, old_version_repository, initial_data, mock_urllib):
    """Test the django command extension
    update_repository_version without using filters"""

    repo_id, old_version = old_version_repository

    call_command('update_repository_version')

    updated_version = refdata.get_repository_version_id(repo_id)

    assert old_version < updated_version


def test_update_repo_version_command_with_filters(refdata, old_version_repository, initial_data, mock_urllib):
    """Test the django command extension
    update_repository_version using all the filters"""

    repo_id, old_version = old_version_repository

    call_command('update_repository_version',
                 repo_name='mozilla-central',
                 group_name='mygroup',
                 codebase='gecko')

    updated_version = refdata.get_repository_version_id(repo_id)

    assert old_version < updated_version


@pytest.fixture
def sample_bugs(test_base_dir):
    filename = os.path.join(
        test_base_dir,
        'sample_data',
        'bug_list.json'
    )
    return json.loads(open(filename).read())


def test_update_bugscache(refdata, sample_bugs):
    """
    Test running twice update_bugscache inserts the rows just once
    """

    bug_list = sample_bugs['bugs']

    #first iteration, inserts
    refdata.update_bugscache(bug_list)
    row_data = refdata.dhub.execute(
        proc='refdata_test.selects.test_bugscache',
        return_type='tuple'
    )

    assert len(bug_list) == len(row_data)

    # second iteration, updates
    refdata.update_bugscache(bug_list)

    row_data = refdata.dhub.execute(
        proc='refdata_test.selects.test_bugscache',
        return_type='tuple'
    )

    assert len(bug_list) == len(row_data)


def test_get_suggested_bugs(refdata, sample_bugs):
    """
    Test that at least one result is retrieved
    for the right search terms
    """
    bug_list = sample_bugs['bugs']
    refdata.update_bugscache(bug_list)
    row_data = refdata.dhub.execute(
        proc='refdata_test.selects.test_bugscache',
        return_type='tuple'
    )

    search_terms = ['few-pixel',
                    'nsDirEnumerator',
                    'WinFileAttributes tests - TEST-UNEXPECTED-FAIL | Test '
                    'Win Attribs: GetFileAttributesWin attributed did not match. (2)']

    for search_term in search_terms:
        suggestions = refdata.get_suggested_bugs(search_term)
        assert len(suggestions) >= 0
