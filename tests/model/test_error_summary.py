import datetime
from unittest.mock import MagicMock, patch

import pytest

from treeherder.model.error_summary import (
    cache_clean_error_line,
    get_cleaned_line,
    get_crash_signature,
    get_error_search_term_and_path,
    get_error_summary,
    get_line_bug_suggestions,
)

LINE_CLEANING_TEST_CASES = (
    (
        (
            "00:54:20     INFO - GECKO(1943) | Assertion failure: rc != 0 "
            "(destroyed timer off its target thread!), at "
            "/builds/worker/checkouts/gecko/xpcom/threads/TimerThread.cpp:434"
        ),
        (
            "Assertion failure: rc != 0 (destroyed timer off its target thread!),"
            " at "
            "/builds/worker/checkouts/gecko/xpcom/threads/TimerThread.cpp:X"
        ),
    ),
    (
        (
            "17:22:43 INFO - PID 2944 | [6132] Assertion failure: XRE_IsGPUProcess()"
            " || gfxPlatform::GetPlatform()->DevicesInitialized(),"
            " at /builds/worker/checkouts/gecko/gfx/thebes/DeviceManagerDx.cpp:1320"
        ),
        (
            "Assertion failure: XRE_IsGPUProcess()"
            " || gfxPlatform::GetPlatform()->DevicesInitialized(),"
            " at /builds/worker/checkouts/gecko/gfx/thebes/DeviceManagerDx.cpp:X"
        ),
    ),
    (
        (
            "10:27:00  WARNING -  PROCESS-CRASH | [Child 8959, Main Thread] ###!!! ASSERTION:"
            " Should only schedule view manager flush on root prescontexts: 'mPresContext &&"
            " mPresContext->IsRoot()', file /builds/worker/checkouts/gecko/layout/base/nsRefreshDriver.cpp:2931"
            " [@ nsRefreshDriver::SchedulePaint] | docshell/test/unit/test_subframe_stop_after_parent_error.js"
        ),
        (
            "PROCESS-CRASH | [Child X, Y Thread] ###!!! ASSERTION:"
            " Should only schedule view manager flush on root prescontexts: 'mPresContext &&"
            " mPresContext->IsRoot()', file /builds/worker/checkouts/gecko/layout/base/nsRefreshDriver.cpp:X"
            " [@ nsRefreshDriver::SchedulePaint] | docshell/test/unit/test_subframe_stop_after_parent_error.js"
        ),
    ),
)


@pytest.mark.parametrize(("line_raw", "exp_line_cleaned"), LINE_CLEANING_TEST_CASES)
def test_get_cleaned_line(line_raw, exp_line_cleaned):
    """
    Test cleaning from of error line from unnecessary information, e.g.
    mozharness timestamps and process ids
    """
    actual_line_cleaned = get_cleaned_line(line_raw)
    assert actual_line_cleaned == exp_line_cleaned


PIPE_DELIMITED_LINE_TEST_CASES = (
    (
        (
            "596 INFO TEST-UNEXPECTED-FAIL "
            "| chrome://mochitests/content/browser/browser/components/loop/test/mochitest/browser_fxa_login.js "
            "| Check settings tab URL - Got http://mochi.test:8888/browser/browser/components/loop/test/mochitest/loop_fxa.sjs"
        ),
        {
            "path_end": "chrome://mochitests/content/browser/browser/components/loop/test/mochitest/browser_fxa_login.js",
            "search_term": ["browser_fxa_login.js"],
        },
    ),
    (
        (
            "REFTEST TEST-UNEXPECTED-FAIL "
            "| file:///C:/slave/test/build/tests/reftest/tests/layout/reftests/layers/component-alpha-exit-1.html "
            "| image comparison (==), max difference: 255, number of differing pixels: 251"
        ),
        {
            "path_end": "file:///C:/slave/test/build/tests/reftest/tests/layout/reftests/layers/component-alpha-exit-1.html",
            "search_term": ["component-alpha-exit-1.html"],
        },
    ),
    (
        (
            "2423 INFO TEST-UNEXPECTED-FAIL "
            "| /tests/dom/media/tests/mochitest/test_dataChannel_basicAudio.html "
            "| undefined assertion name - Result logged after SimpleTest.finish()"
        ),
        {
            "path_end": "/tests/dom/media/tests/mochitest/test_dataChannel_basicAudio.html",
            "search_term": ["test_dataChannel_basicAudio.html"],
        },
    ),
    (
        (
            r"TEST-UNEXPECTED-FAIL "
            r"| mainthreadio "
            r"| File 'c:\users\cltbld~1.t-w' was accessed and we were not expecting it: {'Count': 6, 'Duration': 0.112512, 'RunCount': 6}"
        ),
        {
            "path_end": "mainthreadio",
            "search_term": ["mainthreadio"],
        },
    ),
    (
        (
            "REFTEST PROCESS-CRASH "
            "| application crashed [@ jemalloc_crash] "
            "| http://10.0.2.2:8854/tests/dom/canvas/test/reftest/webgl-resize-test.html == "
            "http://10.0.2.2:8854/tests/dom/canvas/test/reftest/wrapper.html?green.png"
        ),
        {
            "path_end": "http://10.0.2.2:8854/tests/dom/canvas/test/reftest/webgl-resize-test.html",
            "search_term": ["application crashed [@ jemalloc_crash]"],
        },
    ),
    (
        (
            "REFTEST PROCESS-CRASH "
            "| application crashed [@ jemalloc_crash] "
            "| http://10.0.2.2:8854/tests/dom/canvas/test/reftest/webgl-resize-test.html != "
            "http://10.0.2.2:8854/tests/dom/canvas/test/reftest/wrapper.html?green.png"
        ),
        {
            "path_end": "http://10.0.2.2:8854/tests/dom/canvas/test/reftest/webgl-resize-test.html",
            "search_term": ["application crashed [@ jemalloc_crash]"],
        },
    ),
    (
        (
            "TEST-UNEXPECTED-FAIL "
            "| /tests/dom/events/test/pointerevents/pointerevent_touch-action-table-test_touch-manual.html "
            "| touch-action attribute test on the cell: assert_true: scroll received while shouldn't expected true got false"
        ),
        {
            "path_end": "/tests/dom/events/test/pointerevents/pointerevent_touch-action-table-test_touch-manual.html",
            "search_term": ["pointerevent_touch-action-table-test_touch-manual.html"],
        },
    ),
)


@pytest.mark.parametrize(("line", "exp_search_info"), PIPE_DELIMITED_LINE_TEST_CASES)
def test_get_delimited_search_term(line, exp_search_info):
    """Test search term extraction for a pipe delimited error line"""
    actual_search_info = get_error_search_term_and_path(line)
    assert actual_search_info == exp_search_info


PIPE_DELIMITED_LINE_TEST_CASES_WITH_PARAMS = (
    (
        (
            "INFO TEST-UNEXPECTED-TIMEOUT "
            "| /html/cross-origin-opener-policy/coep-navigate-popup.https.html?4-last "
            "| TestRunner hit external timeout (this may indicate a hang)"
        ),
        {
            "path_end": "/html/cross-origin-opener-policy/coep-navigate-popup.https.html?4-last",
            "search_term": [
                "coep-navigate-popup.https.html?4-last",
                "coep-navigate-popup.https.html",
            ],
        },
    ),
)


@pytest.mark.parametrize(("line", "exp_search_info"), PIPE_DELIMITED_LINE_TEST_CASES_WITH_PARAMS)
def test_get_delimited_search_term_with_params(line, exp_search_info):
    """Test search term extraction for a pipe delimited error line"""
    actual_search_info = get_error_search_term_and_path(line)
    assert actual_search_info == exp_search_info


LEAK_LINE_TEST_CASES = (
    (
        (
            "TEST-UNEXPECTED-FAIL "
            "| leakcheck | 13195 bytes leaked "
            "(BackstagePass, CallbackObject, DOMEventTargetHelper, "
            "EventListenerManager, EventTokenBucket, ...)"
        ),
        {
            "path_end": None,
            "search_term": [
                "BackstagePass, CallbackObject, DOMEventTargetHelper, EventListenerManager, EventTokenBucket, ..."
            ],
        },
    ),
    (
        (
            "TEST-UNEXPECTED-FAIL "
            "| leakcheck | tab process: 44330 bytes leaked "
            "(AsyncLatencyLogger, AsyncTransactionTrackersHolder, AudioOutputObserver, "
            "BufferRecycleBin, CipherSuiteChangeObserver, ...)"
        ),
        {
            "path_end": None,
            "search_term": [
                "AsyncLatencyLogger, AsyncTransactionTrackersHolder, AudioOutputObserver, BufferRecycleBin, CipherSui"
            ],
        },
    ),
    (
        (
            "TEST-UNEXPECTED-FAIL "
            "| LeakSanitizer | leak at "
            "MakeUnique, nsThread::nsChainedEventQueue::nsChainedEventQueue, nsThread, nsThreadManager::Init"
        ),
        {
            "path_end": None,
            "search_term": [
                "MakeUnique, nsThread::nsChainedEventQueue::nsChainedEventQueue, nsThread, nsThreadManager::Init"
            ],
        },
    ),
)


@pytest.mark.parametrize(("line", "exp_search_info"), LEAK_LINE_TEST_CASES)
def test_get_leak_search_term(line, exp_search_info):
    """tests the search term extracted from a leak error line is correct"""
    actual_search_info = get_error_search_term_and_path(line)
    assert actual_search_info == exp_search_info


FULL_LINE_FALLBACK_TEST_CASES = (
    (
        "Automation Error: No crash directory (/mnt/sdcard/tests/profile/minidumps/) found on remote device",
        {
            "path_end": None,
            "search_term": [
                "Automation Error: No crash directory (/mnt/sdcard/tests/profile/minidumps/) found on remote device"
            ],
        },
    ),
    (
        "PROCESS-CRASH | Automation Error: Missing end of test marker (process crashed?)",
        {
            "path_end": None,
            "search_term": [
                "Automation Error: Missing end of test marker (process crashed?)",
                "Automation Error: Missing end of test marker (process crashed",
            ],
        },
    ),
)


@pytest.mark.parametrize(("line", "exp_search_info"), FULL_LINE_FALLBACK_TEST_CASES)
def test_get_full_line_search_term(line, exp_search_info):
    """Test that the full error line is used as a fall-back if no test name found"""
    actual_search_info = get_error_search_term_and_path(line)
    assert actual_search_info == exp_search_info


LONG_LINE_TEST_CASES = (
    (
        (
            "command timed out: 2400 seconds without output running "
            "['/tools/buildbot/bin/python', "
            "'scripts/scripts/android_emulator_unittest.py', '--cfg', "
            "'android/androidx86.py', '--test-suite', 'robocop-1', "
            "'--test-suite', 'robocop-2', '--test-suite', 'robocop-3', "
            "'--test-suite', 'xpcshell', '--blob-upload-branch', "
            "'b2g-inbound', '--download-symbols', 'ondemand'], "
            "attempting to kill"
        ),
        {
            "path_end": None,
            "search_term": [
                "command timed out: 2400 seconds without output running "
                "['/tools/buildbot/bin/python', 'scripts/scrip"
            ],
        },
    ),
    (
        (
            "TEST-UNEXPECTED-FAIL "
            "| frames/marionette/test_switch_frame.py TestSwitchFrame.test_should_be_able_to_carry_on_working_if_the_frame_is_deleted_from_under_us "
            "| AssertionError: 0 != 1"
        ),
        {
            "path_end": "frames/marionette/test_switch_frame.py",
            "search_term": ["test_switch_frame.py"],
        },
    ),
)

# command timed out: 2400 seconds without output running ['/tools/buildbot/bin/python', 'scripts/scripts/android_emulator_unittest.py', '--cfg', 'android/androidx86.py', '--test-suite', 'robocop-1', '--test-suite', 'robocop-2', '--test-suite', 'robocop-3', '--test-suite', 'xpcshell', '--blob-upload-branch', 'b2g-inbound', '--download-symbols', 'ondemand'], attempting to kill


@pytest.mark.parametrize(("line", "exp_search_info"), LONG_LINE_TEST_CASES)
def test_get_long_search_term(line, exp_search_info):
    """tests that long search terms are capped at 100 characters"""
    actual_search_info = get_error_search_term_and_path(line)
    assert actual_search_info == exp_search_info


CRASH_LINE_TEST_CASES = (
    (
        (
            "PROCESS-CRASH | application crashed [@ nsInputStreamPump::OnStateStop()] | "
            "file:///C:/slave/test/build/tests/jsreftest/tests/"
            "jsreftest.html?test=test262/ch11/11.4/11.4.1/11.4.1-4.a-6.js"
        ),
        "nsInputStreamPump::OnStateStop()",
    ),
)


@pytest.mark.parametrize(("line", "exp_search_info"), CRASH_LINE_TEST_CASES)
def test_get_crash_signature(line, exp_search_info):
    """tests the search term extracted from an error line is correct"""
    actual_search_info = get_crash_signature(line)
    assert actual_search_info == exp_search_info


BLACKLIST_TEST_CASES = (
    (
        "TEST-UNEXPECTED-FAIL | remoteautomation.py | application timed out after 330 seconds with no output",
        {
            "path_end": "remoteautomation.py",
            "search_term": [
                "remoteautomation.py | application timed out after 330 seconds with no output"
            ],
        },
    ),
    (
        "Return code: 1",
        {
            "path_end": None,
            "search_term": [None],
        },
    ),
    (
        (
            "REFTEST PROCESS-CRASH "
            "| application crashed [@ mozalloc_abort] "
            "| file:///home/worker/workspace/build/tests/reftest/tests/layout/reftests/font-inflation/video-1.html"
        ),
        {
            "path_end": "file:///home/worker/workspace/build/tests/reftest/tests/layout/reftests/font-inflation/video-1.html",
            "search_term": ["application crashed [@ mozalloc_abort]"],
        },
    ),
)


@pytest.mark.parametrize(("line", "exp_search_info"), BLACKLIST_TEST_CASES)
def test_get_blacklisted_search_term(line, exp_search_info):
    """Test search term extraction for lines that contain a blacklisted term"""
    actual_search_info = get_error_search_term_and_path(line)
    assert actual_search_info == exp_search_info


LINES_TO_CACHE_TEST_CASES = (
    (
        "TEST-UNEXPECT-FAIL | test_drag_1digit.html | offset 21.45 pixel is over limit.",
        "TEST-UNEXPECT-FAIL | test_drag_1digit.html | offset X pixel is over limit.",
    ),
    (
        "TEST-UNEXPECT-FAIL | test_drag_nodigit.html | offset 81px is over limit.",
        "TEST-UNEXPECT-FAIL | test_drag_nodigit.html | offset 81px is over limit.",
    ),
    (
        "TEST-UNEXPECT-FAIL | test_complete.html | finished in 617ms.",
        "TEST-UNEXPECT-FAIL | test_complete.html | finished.",
    ),
)


@pytest.mark.parametrize(("line", "exp_cache_line_cleaned"), LINES_TO_CACHE_TEST_CASES)
def test_cache_error_line_cleaning(line, exp_cache_line_cleaned):
    actual_cache_line_cleaned = cache_clean_error_line(line)
    assert actual_cache_line_cleaned == exp_cache_line_cleaned


def _fake_job(repository_name):
    """A minimal stand-in for a Job with just what get_error_summary reads
    before it returns early on an empty queryset."""
    job = MagicMock()
    job.id = 1
    job.repository.name = repository_name
    job.submit_time = datetime.datetime(2024, 1, 15, 12, 0, 0)
    return job


ERROR_LINE_CACHE_KEYROOT_CASES = (
    ("comm-central", "cc_error_lines"),
    ("autoland", "mc_error_lines"),
    ("mozilla-central", "mc_error_lines"),
    ("try", "mc_error_lines"),
)


@pytest.mark.parametrize(("repository_name", "expected_keyroot"), ERROR_LINE_CACHE_KEYROOT_CASES)
@patch("treeherder.model.error_summary.MemDBCache")
@patch("treeherder.model.error_summary.cache")
def test_error_line_cache_selected_by_repository_name(
    mock_cache, mock_memdbcache, repository_name, expected_keyroot
):
    """Only comm-central uses the cc_error_lines cache; everything else uses
    mc_error_lines. The keyroot is chosen from the repository *name*, so a
    comm-central job must not fall through to the mozilla-central namespace."""
    # No cached error summary, so we proceed to the error-line cache selection.
    mock_cache.get.return_value = None
    # Empty queryset makes get_error_summary return early right after it picks
    # the error-line cache, so no DB/log processing is needed.
    get_error_summary(_fake_job(repository_name), queryset=[])

    mock_memdbcache.assert_called_once_with(expected_keyroot)


LEAK_LINE = (
    "TEST-UNEXPECTED-FAIL | LeakSanitizer | leak at "
    "mozilla::dom::AllocateProtoAndIfaceCache, mozilla::dom::CreateGlobal"
)


def _line_job(repository_name="autoland"):
    job = _fake_job(repository_name)
    job.push.revision = "abcdef123456"
    return job


@patch("treeherder.model.error_summary.Bugscache")
@patch("treeherder.model.error_summary.MemDBCache")
@patch("treeherder.model.error_summary.cache")
def test_line_bug_suggestions_read_the_line_counts_without_writing_them(
    mock_cache, mock_memdbcache, mock_bugscache
):
    """A line sent as text gets the bugs its search term finds and the counts
    other jobs' logs recorded, and is not counted itself, even on autoland."""
    mock_cache.get.return_value = None
    line_key = cache_clean_error_line(LEAK_LINE)
    lcache = mock_memdbcache.return_value
    lcache.get_cache.return_value = {
        "2024-01-13": None,
        "2024-01-14": {line_key: 2},
        "2024-01-15": {"new_lines": {line_key: "abcdef123456"}, line_key: 1},
    }
    bug = {"id": 1775819, "summary": "Intermittent LeakSanitizer | leak at ..."}
    mock_bugscache.search.return_value = {"open_recent": [bug], "all_others": []}

    [suggestion] = get_line_bug_suggestions(_line_job(), [LEAK_LINE])

    assert suggestion == {
        "search": LEAK_LINE,
        "search_terms": get_error_search_term_and_path(LEAK_LINE)["search_term"],
        "path_end": get_error_search_term_and_path(LEAK_LINE)["path_end"],
        "bugs": {"open_recent": [bug], "all_others": []},
        "line_number": None,
        "counter": 3,
        "failure_new_in_rev": True,
    }
    lcache.write_cache.assert_not_called()
    lcache.update_cache.assert_not_called()
    lcache.update_db_cache.assert_not_called()
    lcache.remove_cache_key.assert_not_called()
    assert mock_cache.set.call_args.args[0].startswith("line-bug-suggestions-1-")


@patch("treeherder.model.error_summary.Bugscache")
@patch("treeherder.model.error_summary.MemDBCache")
@patch("treeherder.model.error_summary.cache")
def test_line_bug_suggestions_keep_the_line_order(mock_cache, mock_memdbcache, mock_bugscache):
    """One suggestion per line, in order; a line with nothing left once
    cleaned gets an empty one instead of a search."""
    mock_cache.get.return_value = None
    mock_memdbcache.return_value.get_cache.return_value = {}
    mock_bugscache.search.return_value = {"open_recent": [], "all_others": []}
    lines = [
        "TEST-UNEXPECTED-FAIL | dom/tests/test_a.html | boom",
        "   ",
        "TEST-UNEXPECTED-TIMEOUT | dom/tests/test_b.html | took too long",
    ]

    suggestions = get_line_bug_suggestions(_line_job("try"), lines)

    assert [suggestion["search"] for suggestion in suggestions] == [lines[0], "", lines[2]]
    assert [suggestion["counter"] for suggestion in suggestions] == [0, 0, 0]
    assert suggestions[1]["bugs"] == {"open_recent": [], "all_others": []}
    assert suggestions[1]["search_terms"] == []


@patch("treeherder.model.error_summary.MemDBCache")
@patch("treeherder.model.error_summary.cache")
def test_line_bug_suggestions_served_from_the_cache(mock_cache, mock_memdbcache):
    mock_cache.get.return_value = [{"search": "cached"}]

    assert get_line_bug_suggestions(_line_job(), [LEAK_LINE]) == [{"search": "cached"}]
    mock_memdbcache.assert_not_called()


@pytest.mark.parametrize(("repository_name", "expected_keyroot"), ERROR_LINE_CACHE_KEYROOT_CASES)
@patch("treeherder.model.error_summary.MemDBCache")
@patch("treeherder.model.error_summary.cache")
def test_line_bug_suggestions_read_the_repository_line_cache(
    mock_cache, mock_memdbcache, repository_name, expected_keyroot
):
    mock_cache.get.return_value = None
    mock_memdbcache.return_value.get_cache.return_value = {}

    get_line_bug_suggestions(_line_job(repository_name), [])

    mock_memdbcache.assert_called_once_with(expected_keyroot)
