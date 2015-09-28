import json
import os
import time
from datetime import (datetime,
                      timedelta)

import pytest

from treeherder.model.models import (Repository,
                                     RepositoryGroup)


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


time_now = int(time.time())
test_params = [
    {
        'func': 'get_or_create_build_platforms',

        'input': [
            ['linux', 'Fedora 12', 'x86_64'],
            # Duplicate input to test aggregation
            ['linux', 'Fedora 12', 'x86_64'],
            ['linux', 'Fedora 13', 'x86_64'],
            ['linux', 'Fedora 14', 'x86'],
        ],

        'expected': {
            'linux-Fedora 12-x86_64': {
                'id': 1, 'os_name': 'linux', 'platform': 'Fedora 12',
                'architecture': 'x86_64',
            },
            'linux-Fedora 13-x86_64': {
                'id': 2, 'os_name': 'linux', 'platform': 'Fedora 13',
                'architecture': 'x86_64',
            },
            'linux-Fedora 14-x86': {
                'id': 3, 'os_name': 'linux', 'platform': 'Fedora 14',
                'architecture': 'x86',
            },
        }
    },
    {
        'func': 'get_or_create_job_groups',
        'input': [
            # Duplicate group to test aggregation
            ['mygroup1', 'MG1'],
            ['mygroup2', 'MG2'],
            ['mygroup3', 'MG3'],
            ['mygroup4', 'MG4'],
            ['mygroup4', 'MG4']
        ],
        'expected': {
            'mygroup1-MG1': {'id': 1, 'name': 'mygroup1', 'symbol': 'MG1'},
            'mygroup2-MG2': {'id': 2, 'name': 'mygroup2', 'symbol': 'MG2'},
            'mygroup3-MG3': {'id': 3, 'name': 'mygroup3', 'symbol': 'MG3'},
            'mygroup4-MG4': {'id': 4, 'name': 'mygroup4', 'symbol': 'MG4'},
        }
    },
    {
        'func': 'get_or_create_job_types',
        # Duplicate type to test aggregation
        'input': [
            ['mytype1', 'MT1', 'mygroup1', 'MG1'],
            ['mytype2', 'MT2', 'mygroup2', 'MG2'],
            ['mytype3', 'MT3', 'mygroup3', 'MG3'],
            ['mytype4', 'MT4', 'mygroup4', 'MG4'],
            ['mytype4', 'MT4', 'mygroup4', 'MG4']
        ],
        'expected': {
            'mytype1-MT1': {'id': 1, 'name': 'mytype1', 'symbol': 'MT1', 'job_group_id': None},
            'mytype2-MT2': {'id': 2, 'name': 'mytype2', 'symbol': 'MT2', 'job_group_id': None},
            'mytype3-MT3': {'id': 3, 'name': 'mytype3', 'symbol': 'MT3', 'job_group_id': None},
            'mytype4-MT4': {'id': 4, 'name': 'mytype4', 'symbol': 'MT4', 'job_group_id': None},
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
            'machine1': {'id': 1, 'name': 'machine1'},
            'machine2': {'id': 2, 'name': 'machine2'},
            'machine3': {'id': 3, 'name': 'machine3'},
            'machine4': {'id': 4, 'name': 'machine4'},
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
            'linux-Fedora 12-x86_64': {
                'id': 1, 'os_name': 'linux', 'platform': 'Fedora 12',
                'architecture': 'x86_64',
            },
            'linux-Fedora 13-x86_64': {
                'id': 2, 'os_name': 'linux', 'platform': 'Fedora 13',
                'architecture': 'x86_64',
            },
            'linux-Fedora 14-x86': {
                'id': 3, 'os_name': 'linux', 'platform': 'Fedora 14',
                'architecture': 'x86',
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
            'product1': {'id': 1, 'name': 'product1'},
            'product2': {'id': 2, 'name': 'product2'},
            'product3': {'id': 3, 'name': 'product3'},
            'product4': {'id': 4, 'name': 'product4'},
        }
    }
]


@pytest.mark.parametrize(("params"), test_params)
def test_refdata_manager(refdata, params):
    """test get_or_create methods produce the right content"""

    expected = getattr(refdata, params['func'])(params['input'])
    assert expected == params['expected']

    refdata.disconnect()


# some tests don't fit into a standard layout
def test_reference_data_signatures(refdata):

    reference_data_sample = [
        ['buildername 1', 'buildbot', 'myrepo', [
            'buildbot', 'myrepo', 'macosx', '10.8', 'x64', 'macosx', '10.8', 'x64',
            'Mochitest', 'M', 'mochitest-1', 'M-1', 'asdfasdfasdf']],

        ['buildername 2', 'buildbot', 'myrepo', [
            'buildbot', 'myrepo', 'macosx', '10.8', 'x64', 'macosx', '10.8', 'x64',
            'Mochitest', 'M', 'mochitest-2', 'M-2', 'asdfasdfasdf']],

        ['buildername 3', 'buildbot', 'myrepo', [
            'buildbot', 'myrepo', 'macosx', '10.8', 'x64', 'macosx', '10.8', 'x64',
            'Mochitest', 'M', 'mochitest-3', 'M-2', 'asdfasdfasdf']]]

    expected_signatures = []
    for d in reference_data_sample:
        expected_signatures.append(
            refdata.add_reference_data_signature(d[0], d[1], d[2], d[3]))

    refdata.process_reference_data_signatures()

    row_data = refdata.dhub.execute(
        proc='refdata_test.selects.test_reference_data_signatures'
    )

    refdata.disconnect()

    for row, expected_signature in zip(row_data, expected_signatures):
        assert row['signature'] == expected_signature


def test_add_job_type(refdata):

    job_data = [
        ['mytype1', 'MT1', 'mygroup1', 'MG1'],
        ['mytype2', 'MT2', 'mygroup2', 'MG2'],
        ['mytype3', 'MT3', 'mygroup3', 'MG3'],
        ['mytype4', 'MT4', 'mygroup4', 'MG4'],
        ['mytype4', 'MT4', 'mygroup4', 'MG4'],
        ['mytype4', '?', 'mygroup4', '?'],
        ['unknown', '?', 'unknown', '?'],
        ['unknown', '?', 'unknown', '?'],
        ['?', '?', '?', '?'],
        ['?', '?', '?', '?'],
        ['B2G Emulator Image Build', 'B', None, '?'],
        [None, 'B', None, '?'],
    ]

    expected = (
        {'name': 'mytype1', 'symbol': 'MT1', 'job_group_id': 1},
        {'name': 'mytype2', 'symbol': 'MT2', 'job_group_id': 2},
        {'name': 'mytype3', 'symbol': 'MT3', 'job_group_id': 3},
        {'name': 'mytype4', 'symbol': 'MT4', 'job_group_id': 4},
        {'name': 'mytype4', 'symbol': '?', 'job_group_id': 5},
        {'name': 'unknown', 'symbol': '?', 'job_group_id': 6},
        {'name': '?', 'symbol': '?', 'job_group_id': 7},
        {'name': 'B2G Emulator Image Build', 'symbol': 'B', 'job_group_id': 6},
        {'name': 'unknown', 'symbol': 'B', 'job_group_id': 6},
    )

    keys = []
    for data in job_data:
        key = refdata.add_job_type(
            data[0], data[1], data[2], data[3]
        )
        keys.append(key)

    refdata.process_job_groups()
    job_lookup = refdata.process_job_types()

    for key in keys:
        assert key in job_lookup

    row_data = refdata.dhub.execute(
        proc='refdata_test.selects.test_all_job_group_ids'
    )

    refdata.disconnect()

    assert row_data == expected


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

    refdata.disconnect()

    for k, v in expected.items():
        assert info[k] == v


@pytest.fixture
def sample_bugs(test_base_dir):
    filename = os.path.join(
        test_base_dir,
        'sample_data',
        'bug_list.json'
    )
    with open(filename) as f:
        return json.loads(f.read())


def test_update_bugscache(refdata, sample_bugs):
    """Test running update_bugscache twice inserts the rows just once."""

    bug_list = sample_bugs['bugs']

    # first iteration, inserts
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

    refdata.disconnect()

    assert len(bug_list) == len(row_data)


BUG_SEARCHES = (
    (
        "test_popup_preventdefault_chrome.xul",
        [455091]
    ),
    (
        "test_popup_preventdefault_chrome.xul foo bar",
        []
    ),
    (
        "test_switch_frame.py TestSwitchFrame.test_should_be_able_to_carry_on_working_if_the_frame_is_deleted",
        [1054669, 1078237]
    ),
    (
        "command timed out: 3600 seconds without output running ['/tools/buildbot/bin/python', 'scripts/scrip",
        [1054456]
    ),
    (
        "should not be match_d",
        []
    ),
    (
        "should not be match%d",
        []
    ),
    (
        "should not be matche=d",
        []
    ),
)


@pytest.mark.parametrize(("search_term", "exp_bugs"), BUG_SEARCHES)
def test_get_open_recent_bugs(refdata, sample_bugs, search_term, exp_bugs):
    """Test that we retrieve the expected open recent bugs for a search term."""
    bug_list = sample_bugs['bugs']
    fifty_days_ago = datetime.now() - timedelta(days=50)
    # Update the last_change date so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug['last_change_time'] = fifty_days_ago
    refdata.update_bugscache(bug_list)

    suggestions = refdata.get_bug_suggestions(search_term)
    open_recent_bugs = [b['id'] for b in suggestions['open_recent']]
    assert open_recent_bugs == exp_bugs
    assert len(suggestions['all_others']) == 0


@pytest.mark.parametrize(("search_term", "exp_bugs"), BUG_SEARCHES)
def test_get_all_other_bugs(refdata, sample_bugs, search_term, exp_bugs):
    """Test that we retrieve the expected old bugs for a search term."""
    bug_list = sample_bugs['bugs']
    ninetyfive_days_ago = datetime.now() - timedelta(days=95)
    # Update the last_change date so that all bugs will be placed in
    # the all_others bucket, and none in open_recent.
    for bug in bug_list:
        bug['last_change_time'] = ninetyfive_days_ago
    refdata.update_bugscache(bug_list)

    suggestions = refdata.get_bug_suggestions(search_term)
    assert len(suggestions['open_recent']) == 0
    all_others_bugs = [b['id'] for b in suggestions['all_others']]
    assert all_others_bugs == exp_bugs


def test_get_recent_resolved_bugs(refdata, sample_bugs):
    """Test that we retrieve recent, but fixed bugs for a search term."""
    search_term = "Recently modified resolved bugs should be returned in all_others"
    exp_bugs = [100001]

    bug_list = sample_bugs['bugs']
    fifty_days_ago = datetime.now() - timedelta(days=50)
    # Update the last_change date so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug['last_change_time'] = fifty_days_ago
    refdata.update_bugscache(bug_list)

    suggestions = refdata.get_bug_suggestions(search_term)
    assert len(suggestions['open_recent']) == 0
    all_others_bugs = [b['id'] for b in suggestions['all_others']]
    assert all_others_bugs == exp_bugs


def test_delete_bugscache(refdata, sample_bugs):
    bug_list = sample_bugs['bugs']
    refdata.update_bugscache(bug_list)

    refdata.delete_bugs([bug["id"] for bug in bug_list])
    row_data = refdata.dhub.execute(
        proc='refdata_test.selects.test_bugscache',
        return_type='tuple'
    )
    assert len(row_data) == 0
