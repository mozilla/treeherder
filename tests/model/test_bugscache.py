import json
import os
from datetime import (datetime,
                      timedelta)

import pytest

from treeherder.model.models import Bugscache


@pytest.fixture
def sample_bugs(test_base_dir):
    filename = os.path.join(
        test_base_dir,
        'sample_data',
        'bug_list.json'
    )
    with open(filename) as f:
        return json.load(f)


def _update_bugscache(bug_list):
    for bug in bug_list:
        Bugscache.objects.create(
            id=bug['id'],
            status=bug['status'],
            resolution=bug['resolution'],
            summary=bug['summary'],
            crash_signature=bug['cf_crash_signature'],
            keywords=",".join(bug['keywords']),
            os=bug['op_sys'],
            modified=bug['last_change_time'])


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
def test_get_open_recent_bugs(transactional_db, sample_bugs, search_term, exp_bugs):
    """Test that we retrieve the expected open recent bugs for a search term."""
    bug_list = sample_bugs['bugs']
    fifty_days_ago = datetime.now() - timedelta(days=50)
    # Update the last_change date so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug['last_change_time'] = fifty_days_ago
    _update_bugscache(bug_list)
    resp = Bugscache.search(search_term)
    suggestions = json.loads(json.dumps(resp))
    open_recent_bugs = [b['id'] for b in suggestions['open_recent']]
    assert open_recent_bugs == exp_bugs
    assert len(suggestions['all_others']) == 0


@pytest.mark.parametrize(("search_term", "exp_bugs"), BUG_SEARCHES)
def test_get_all_other_bugs(transactional_db, sample_bugs, search_term, exp_bugs):
    """Test that we retrieve the expected old bugs for a search term."""
    bug_list = sample_bugs['bugs']
    ninetyfive_days_ago = datetime.now() - timedelta(days=95)
    # Update the last_change date so that all bugs will be placed in
    # the all_others bucket, and none in open_recent.
    for bug in bug_list:
        bug['last_change_time'] = ninetyfive_days_ago
    _update_bugscache(bug_list)

    resp = Bugscache.search(search_term)
    suggestions = json.loads(json.dumps(resp))
    assert len(suggestions['open_recent']) == 0
    all_others_bugs = [b['id'] for b in suggestions['all_others']]
    assert all_others_bugs == exp_bugs


def test_get_recent_resolved_bugs(transactional_db, sample_bugs):
    """Test that we retrieve recent, but fixed bugs for a search term."""
    search_term = "Recently modified resolved bugs should be returned in all_others"
    exp_bugs = [100001]

    bug_list = sample_bugs['bugs']
    fifty_days_ago = datetime.now() - timedelta(days=50)
    # Update the last_change date so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug['last_change_time'] = fifty_days_ago
    _update_bugscache(bug_list)

    resp = Bugscache.search(search_term)
    suggestions = json.loads(json.dumps(resp))
    print suggestions
    assert len(suggestions['open_recent']) == 0
    all_others_bugs = [b['id'] for b in suggestions['all_others']]
    assert all_others_bugs == exp_bugs


def test_bug_properties(transactional_db, sample_bugs):
    """Test that we retrieve recent, but fixed bugs for a search term."""
    search_term = "test_popup_preventdefault_chrome.xul"
    bug_list = sample_bugs['bugs']
    fifty_days_ago = datetime.now() - timedelta(days=50)
    # Update the last_change date so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug['last_change_time'] = fifty_days_ago
    _update_bugscache(bug_list)

    expected_keys = set(['crash_signature', 'resolution', 'summary', 'keywords', 'os', 'id',
                         'status'])

    resp = Bugscache.search(search_term)
    suggestions = json.loads(json.dumps(resp))
    assert set(suggestions['open_recent'][0].keys()) == expected_keys
