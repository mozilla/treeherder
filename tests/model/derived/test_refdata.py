import json
import os
from datetime import (datetime,
                      timedelta)

import pytest

from treeherder.model.models import (Repository,
                                     RepositoryGroup)


@pytest.fixture
def repository_id(transactional_db):
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
