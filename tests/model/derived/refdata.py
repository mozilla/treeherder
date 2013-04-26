import os
import pytest
from django.conf import settings
from treeherder.model.derived import RefDataManager
from datasource.bases.BaseHub import BaseHub
from treeherder.model.models import RepositoryGroup, Repository


@pytest.fixture(scope="module")
def refdata():
    """returns a patched RefDataManager for testing purpose"""

    refdata = RefDataManager()

    #make the test procs available to RefDataManager
    del BaseHub.procs['reference']
    refdata.dhub.data_sources['reference']["procs"].append(
        os.path.join(
            os.path.abspath(os.path.dirname(__file__)),
            "refdata_test.json"
        )
    )
    refdata.dhub.load_procs('reference')
    return refdata


@pytest.fixture(scope="module")
def repository_id():
    repo_group = RepositoryGroup(
        name='mygroup',
        description='fill me',
        active_status='active'
    )
    repo_group.save()
    repo = Repository.objects.create(
        repository_group=repo_group,
        name='myrepo',
        type='git',
        url='https://github.com/mozilla/treeherder-service.git',
        branch='mybranch',
        project_name='myproject',
        purpose='development',
        active_status='active'
    )
    return repo.id


test_params = [
    {
        'func': 'get_or_create_build_platform',
        'input': ['linux', 'Fedora 12', 'x86_64'],
        'test_proc': 'refdata_test.selects.test_build_platform',
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
        'test_proc': 'refdata_test.selects.test_job_group',
        'expected': [{
            'symbol': 'fill me',
            'name': 'mygroup',
            'description': 'fill me',
            'active_status': 'active'
        }]
    },
    {
        'input': ['myname', 'mygroup'],
        'func': 'get_or_create_job_type',
        'test_proc': 'refdata_test.selects.test_job_type',
        'expected': [{
            'symbol': 'fill me',
            'name': 'myname',
            'group': 'mygroup',
            'description': 'fill me',
            'active_status': 'active'
        }]
    },
    {
        'input': ['myname', 1366290144.07455],
        'func': 'get_or_create_machine',
        'test_proc': 'refdata_test.selects.test_machine',
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
        'test_proc': 'refdata_test.selects.test_machine_platform',
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
        'test_proc': 'refdata_test.selects.test_option',
        'expected': [{
            'name': 'myoption',
            'description': 'fill me',
            'active_status': 'active'
        }]
    },
    {
        'func': 'get_or_create_option_collection',
        'input': [['option1', 'option2']],
        'test_proc': 'refdata_test.selects.test_option_collection',
        'expected': [{'name': 'option1'}, {'name': 'option2'}]
    },
    {
        'func': 'get_or_create_product',
        'input': ['myproduct'],
        'test_proc': 'refdata_test.selects.test_product',
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

    assert row_data["symbol"] == 'fill me'
    assert row_data["name"] == 'mygroup'
    assert row_data["description"] == 'fill me'
    assert row_data["active_status"] == 'active'

