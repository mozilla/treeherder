import pytest

from treeherder.model.error_summary import (get_crash_signature,
                                            get_error_search_term)

PIPE_DELIMITED_LINE_TEST_CASES = (
    (
        (
            '596 INFO TEST-UNEXPECTED-FAIL '
            '| chrome://mochitests/content/browser/browser/components/loop/test/mochitest/browser_fxa_login.js '
            '| Check settings tab URL - Got http://mochi.test:8888/browser/browser/components/loop/test/mochitest/loop_fxa.sjs'
        ),
        'browser_fxa_login.js'
    ),
    (
        (
            'REFTEST TEST-UNEXPECTED-FAIL '
            '| file:///C:/slave/test/build/tests/reftest/tests/layout/reftests/layers/component-alpha-exit-1.html '
            '| image comparison (==), max difference: 255, number of differing pixels: 251'
        ),
        'component-alpha-exit-1.html'
    ),
    (
        (
            '2423 INFO TEST-UNEXPECTED-FAIL '
            '| /tests/dom/media/tests/mochitest/test_dataChannel_basicAudio.html '
            '| undefined assertion name - Result logged after SimpleTest.finish()'
        ),
        'test_dataChannel_basicAudio.html'
    ),
    (
        (
            "TEST-UNEXPECTED-FAIL "
            "| mainthreadio "
            "| File 'c:\users\cltbld~1.t-w' was accessed and we were not expecting it: {'Count': 6, 'Duration': 0.112512, 'RunCount': 6}"
        ),
        'mainthreadio'
    ),
    (
        (
            "REFTEST PROCESS-CRASH "
            "| http://10.0.2.2:8854/tests/dom/canvas/test/reftest/webgl-resize-test.html == "
            "http://10.0.2.2:8854/tests/dom/canvas/test/reftest/wrapper.html?green.png "
            "| application crashed [@ jemalloc_crash]"
        ),
        'webgl-resize-test.html'
    ),
    (
        (
            "REFTEST PROCESS-CRASH "
            "| http://10.0.2.2:8854/tests/dom/canvas/test/reftest/webgl-resize-test.html != "
            "http://10.0.2.2:8854/tests/dom/canvas/test/reftest/wrapper.html?green.png "
            "| application crashed [@ jemalloc_crash]"
        ),
        'webgl-resize-test.html'
    )
)


@pytest.mark.parametrize(("line", "exp_search_term"), PIPE_DELIMITED_LINE_TEST_CASES)
def test_get_delimited_search_term(line, exp_search_term):
    """Test search term extraction for a pipe delimited error line"""
    actual_search_term = get_error_search_term(line)
    assert actual_search_term == exp_search_term

LEAK_LINE_TEST_CASES = (
    (
        (
            'TEST-UNEXPECTED-FAIL '
            '| leakcheck | 13195 bytes leaked '
            '(BackstagePass, CallbackObject, DOMEventTargetHelper, '
            'EventListenerManager, EventTokenBucket, ...)'
        ),
        'BackstagePass, CallbackObject, DOMEventTargetHelper, EventListenerManager, EventTokenBucket, ...'
    ),
    (
        (
            'TEST-UNEXPECTED-FAIL '
            '| leakcheck | tab process: 44330 bytes leaked '
            '(AsyncLatencyLogger, AsyncTransactionTrackersHolder, AudioOutputObserver, '
            'BufferRecycleBin, CipherSuiteChangeObserver, ...)'
        ),
        'AsyncLatencyLogger, AsyncTransactionTrackersHolder, AudioOutputObserver, BufferRecycleBin, CipherSui'
    ),
)


@pytest.mark.parametrize(("line", "exp_search_term"), LEAK_LINE_TEST_CASES)
def test_get_leak_search_term(line, exp_search_term):
    """tests the search term extracted from a leak error line is correct"""
    actual_search_term = get_error_search_term(line)
    assert actual_search_term == exp_search_term

FULL_LINE_FALLBACK_TEST_CASES = (
    (
        'Automation Error: No crash directory (/mnt/sdcard/tests/profile/minidumps/) found on remote device',
        'Automation Error: No crash directory (/mnt/sdcard/tests/profile/minidumps/) found on remote device'
    ),
    (
        'PROCESS-CRASH | Automation Error: Missing end of test marker (process crashed?)',
        'PROCESS-CRASH | Automation Error: Missing end of test marker (process crashed?)'
    ),
)


@pytest.mark.parametrize(("line", "exp_search_term"), FULL_LINE_FALLBACK_TEST_CASES)
def test_get_full_line_search_term(line, exp_search_term):
    """Test that the full error line is used as a fall-back if no test name found"""
    actual_search_term = get_error_search_term(line)
    assert actual_search_term == exp_search_term

LONG_LINE_TEST_CASES = (
    (
        (
            'command timed out: 2400 seconds without output running '
            '[\'/tools/buildbot/bin/python\', '
            '\'scripts/scripts/android_emulator_unittest.py\', \'--cfg\', '
            '\'android/androidx86.py\', \'--test-suite\', \'robocop-1\', '
            '\'--test-suite\', \'robocop-2\', \'--test-suite\', \'robocop-3\', '
            '\'--test-suite\', \'xpcshell\', \'--blob-upload-branch\', '
            '\'b2g-inbound\', \'--download-symbols\', \'ondemand\'], '
            'attempting to kill'
        ),
        (
            'command timed out: 2400 seconds without output running '
            '[\'/tools/buildbot/bin/python\', \'scripts/scrip'
        )
    ),
    (
        (
            'TEST-UNEXPECTED-FAIL '
            '| test_switch_frame.py TestSwitchFrame.test_should_be_able_to_carry_on_working_if_the_frame_is_deleted_from_under_us '
            '| AssertionError: 0 != 1'
        ),
        'test_switch_frame.py TestSwitchFrame.test_should_be_able_to_carry_on_working_if_the_frame_is_deleted'
    ),
)

# command timed out: 2400 seconds without output running ['/tools/buildbot/bin/python', 'scripts/scripts/android_emulator_unittest.py', '--cfg', 'android/androidx86.py', '--test-suite', 'robocop-1', '--test-suite', 'robocop-2', '--test-suite', 'robocop-3', '--test-suite', 'xpcshell', '--blob-upload-branch', 'b2g-inbound', '--download-symbols', 'ondemand'], attempting to kill


@pytest.mark.parametrize(("line", "exp_search_term"), LONG_LINE_TEST_CASES)
def test_get_long_search_term(line, exp_search_term):
    """tests that long search terms are capped at 100 characters"""
    actual_search_term = get_error_search_term(line)
    assert actual_search_term == exp_search_term

CRASH_LINE_TEST_CASES = (
    (
        (
            'PROCESS-CRASH | file:///C:/slave/test/build/tests/jsreftest/tests/'
            'jsreftest.html?test=test262/ch11/11.4/11.4.1/11.4.1-4.a-6.js | '
            'application crashed [@ nsInputStreamPump::OnStateStop()]'
        ),
        'nsInputStreamPump::OnStateStop()'
    ),
)


@pytest.mark.parametrize(("line", "exp_search_term"), CRASH_LINE_TEST_CASES)
def test_get_crash_signature(line, exp_search_term):
    """tests the search term extracted from an error line is correct"""
    actual_search_term = get_crash_signature(line)
    assert actual_search_term == exp_search_term

BLACKLIST_TEST_CASES = (
    (
        'TEST-UNEXPECTED-FAIL | remoteautomation.py | application timed out after 330 seconds with no output',
        'TEST-UNEXPECTED-FAIL | remoteautomation.py | application timed out after 330 seconds with no output'
    ),
    (
        'Return code: 1',
        None
    ),
)


@pytest.mark.parametrize(("line", "exp_search_term"), BLACKLIST_TEST_CASES)
def test_get_blacklisted_search_term(line, exp_search_term):
    """Test search term extraction for lines that contain a blacklisted term"""
    actual_search_term = get_error_search_term(line)
    assert actual_search_term == exp_search_term
