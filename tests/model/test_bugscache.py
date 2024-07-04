import json
import os
from datetime import datetime, timedelta

import pytest

from treeherder.model.models import Bugscache

fifty_days_ago = datetime.now() - timedelta(days=50)


@pytest.fixture
def sample_bugs(test_base_dir):
    filename = os.path.join(test_base_dir, "sample_data", "bug_list.json")
    with open(filename) as f:
        return json.load(f)


def _update_bugscache(bug_list):
    max_summary_length = Bugscache._meta.get_field("summary").max_length
    max_whiteboard_length = Bugscache._meta.get_field("whiteboard").max_length

    for bug in bug_list:
        Bugscache.objects.create(
            id=bug["id"],
            status=bug["status"],
            resolution=bug["resolution"],
            summary=bug["summary"][:max_summary_length],
            dupe_of=bug["dupe_of"],
            crash_signature=bug["cf_crash_signature"],
            keywords=",".join(bug["keywords"]),
            modified=bug["last_change_time"],
            whiteboard=bug["whiteboard"][:max_whiteboard_length],
            processed_update=True,
        )


BUG_SEARCHES = (
    ("test_popup_preventdefault_chrome.xul", [455091]),
    ("test_Popup_Preventdefault_Chrome.XUL", [455091]),
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
        '[taskcluster:error]  Command " [./test-macosx.sh --no-read-buildbot-config --installer-url=https://q',
        [100],
    ),
    ("should not be match_d", []),
    ("should not be match%d", []),
    ("should not be matche=d", []),
    ("standalone-without-folder.html", [1690234]),
    ("slash-folder.html", [1690235]),
    ("backslash.html", [1690236]),
    ("listitem-001.html", [1690345]),
    ("match-at-start.html", [1690456]),
)


@pytest.mark.parametrize(("search_term", "exp_bugs"), BUG_SEARCHES)
def test_get_open_recent_bugs(transactional_db, sample_bugs, search_term, exp_bugs):
    """Test that we retrieve the expected open recent bugs for a search term."""
    bug_list = sample_bugs["bugs"]
    # Update the resolution so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug["resolution"] = ""
        bug["last_change_time"] = fifty_days_ago
    _update_bugscache(bug_list)
    suggestions = Bugscache.search(search_term)
    open_recent_bugs = [b["id"] for b in suggestions["open_recent"]]
    assert open_recent_bugs == exp_bugs
    assert suggestions["all_others"] == []


@pytest.mark.parametrize(("search_term", "exp_bugs"), BUG_SEARCHES)
def test_get_all_other_bugs(transactional_db, sample_bugs, search_term, exp_bugs):
    """Test that we retrieve the expected old bugs for a search term."""
    bug_list = sample_bugs["bugs"]
    # Update the resolution so that all bugs will be placed in
    # the all_others bucket, and none in open_recent.
    for bug in bug_list:
        bug["resolution"] = "FIXED"
        bug["last_change_time"] = fifty_days_ago
    _update_bugscache(bug_list)

    suggestions = Bugscache.search(search_term)
    assert suggestions["open_recent"] == []
    all_others_bugs = [b["id"] for b in suggestions["all_others"]]
    assert all_others_bugs == exp_bugs


def test_get_recent_resolved_bugs(transactional_db, sample_bugs):
    """Test that we retrieve recent, but fixed bugs for a search term."""
    search_term = "Recently modified resolved bugs should be returned in all_others"
    exp_bugs = [100001]

    bug_list = sample_bugs["bugs"]
    # Update the resolution so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug["resolution"] = "FIXED"
        bug["last_change_time"] = fifty_days_ago
    _update_bugscache(bug_list)

    suggestions = Bugscache.search(search_term)
    assert suggestions["open_recent"] == []
    all_others_bugs = [b["id"] for b in suggestions["all_others"]]
    assert all_others_bugs == exp_bugs


def test_bug_properties(transactional_db, sample_bugs):
    """Test that we retrieve recent, but fixed bugs for a search term."""
    search_term = "test_popup_preventdefault_chrome.xul"
    bug_list = sample_bugs["bugs"]
    # Update the resolution so that all bugs will be placed in
    # the open_recent bucket, and none in all_others.
    for bug in bug_list:
        bug["resolution"] = ""
        bug["last_change_time"] = fifty_days_ago
    _update_bugscache(bug_list)

    expected_keys = set(
        [
            "crash_signature",
            "resolution",
            "summary",
            "dupe_of",
            "keywords",
            "id",
            "status",
            "whiteboard",
        ]
    )

    suggestions = Bugscache.search(search_term)
    assert set(suggestions["open_recent"][0].keys()) == expected_keys


@pytest.mark.django_db(transaction=True)
def test_import(mock_bugscache_bugzilla_request):
    """
    Test importing bug data and building duplicate to open bug
    relationships.
    """

    from treeherder.etl.bugzilla import BzApiBugProcess

    BzApiBugProcess().run()

    bug = Bugscache.objects.get(id=1652208)
    assert bug.status == "RESOLVED"
    assert bug.resolution == "DUPLICATE"
    assert bug.crash_signature == "[@ some::mock_signature]"
    assert (
        bug.summary
        == "Intermittent dom/canvas/test/webgl-conf/generated/test_2_conformance__ogles__GL__swizzlers__swizzlers_105_to_112.html | Test timed out."
    )
    assert bug.whiteboard == "[we have to do something about this][it's urgent]"
    assert bug.keywords == "intermittent-failure"
    assert bug.dupe_of == 1662628

    # key: open bug, values: duplicates
    expected_bug_dupe_of_data = {
        1392106: [1442991, 1443801],
        1411358: [1204281],
        1662628: [1652208, 1660324, 1660719, 1660765, 1663081, 1663118, 1702255],
        1736534: [],
    }

    for open_bug, duplicates in expected_bug_dupe_of_data.items():
        assert Bugscache.objects.get(id=open_bug).dupe_of is None
        assert set(Bugscache.objects.filter(dupe_of=open_bug).values_list("id", flat=True)) == set(
            duplicates
        )

    expected_bug_count = sum(
        [1 + len(duplicates) for duplicates in expected_bug_dupe_of_data.values()]
    )
    assert len(Bugscache.objects.all()) == expected_bug_count
