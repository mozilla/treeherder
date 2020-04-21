import json
import os
from datetime import datetime, timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from treeherder.model.models import Bugscache


@pytest.fixture
def sample_bugs(test_base_dir):
    filename = os.path.join(test_base_dir, 'sample_data', 'bug_list.json')
    with open(filename) as f:
        return json.load(f)


def _update_bugscache(bug_list):
    max_summary_length = Bugscache._meta.get_field('summary').max_length
    max_whiteboard_length = Bugscache._meta.get_field('whiteboard').max_length

    for bug in bug_list:
        Bugscache.objects.create(
            id=bug['id'],
            status=bug['status'],
            resolution=bug['resolution'],
            summary=bug['summary'][:max_summary_length],
            crash_signature=bug['cf_crash_signature'],
            keywords=",".join(bug['keywords']),
            os=bug['op_sys'],
            modified=bug['last_change_time'],
            whiteboard=bug['whiteboard'][:max_whiteboard_length],
        )


BUG_SEARCHES = (
    ("test_popup_preventdefault_chrome.xul", [455091]),
    ("test_popup_preventdefault_chrome.xul foo bar", []),
    (
        "test_switch_frame.py TestSwitchFrame.test_should_be_able_to_carry_on_working_if_the_frame_is_deleted",
        [1054669, 1078237],
    ),
    (
        "command timed out: 3600 seconds without output running ['/tools/buildbot/bin/python', 'scripts/scrip",
        [1054456],
    ),
    (
        "[taskcluster:error]  Command \" [./test-macosx.sh --no-read-buildbot-config --installer-url=https://q",
        [100],
    ),
    ("should not be match_d", []),
    ("should not be match%d", []),
    ("should not be matche=d", []),
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
    suggestions = Bugscache.search(search_term)
    open_recent_bugs = [b['id'] for b in suggestions['open_recent']]
    assert open_recent_bugs == exp_bugs
    assert suggestions['all_others'] == []


@pytest.mark.parametrize(("search_term", "exp_bugs"), BUG_SEARCHES)
def test_get_all_other_bugs(transactional_db, sample_bugs, search_term, exp_bugs):
    """Test that we retrieve the expected old bugs for a search term."""
    bug_list = sample_bugs['bugs']
    fourhundred_days_ago = datetime.now() - timedelta(days=400)
    # Update the last_change date so that all bugs will be placed in
    # the all_others bucket, and none in open_recent.
    for bug in bug_list:
        bug['last_change_time'] = fourhundred_days_ago
    _update_bugscache(bug_list)

    suggestions = Bugscache.search(search_term)
    assert suggestions['open_recent'] == []
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

    suggestions = Bugscache.search(search_term)
    assert suggestions['open_recent'] == []
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

    expected_keys = set(
        ['crash_signature', 'resolution', 'summary', 'keywords', 'os', 'id', 'status', 'whiteboard']
    )

    suggestions = Bugscache.search(search_term)
    assert set(suggestions['open_recent'][0].keys()) == expected_keys


@pytest.mark.parametrize(("search_term", "exp_bugs"), BUG_SEARCHES)
def test_for_empty_search_query(transactional_db, sample_bugs, search_term, exp_bugs):
    """
    Check Bugscache search strings aren't empty when we query with them

    This catches a bug introduced as part of the fix for Bug 1469777.
    """
    bug_list = sample_bugs['bugs']
    fifty_days_ago = datetime.now() - timedelta(days=50)
    # Update the last_change date so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug['last_change_time'] = fifty_days_ago
    _update_bugscache(bug_list)

    def get_search_query(sql):
        search_query, _, _ = sql.partition('\\"\' IN BOOLEAN MODE')
        _, _, search_query = search_query.partition('AGAINST (\'\\"')

        search_query = search_query.strip(' ')
        return search_query

    with CaptureQueriesContext(connection) as context:
        Bugscache.search(search_term)

        search_query = get_search_query(context.captured_queries[0]['sql'])
        assert search_query

        search_query = get_search_query(context.captured_queries[-1]['sql'])
        assert search_query
