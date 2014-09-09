import pytest
from treeherder.log_parser.utils import (get_error_search_term,
                                         get_crash_signature)


ERROR_LINE_TEST_CASES = (
    (
        (
            'TEST-UNEXPECTED-FAIL '
            '| leakcheck | 13195 bytes leaked '
            '(BackstagePass, CallbackObject, DOMEventTargetHelper, '
            'EventListenerManager, EventTokenBucket, ...)'
        ),
        (
            'BackstagePass, CallbackObject, DOMEventTargetHelper, '
            'EventListenerManager, EventTokenBucket, ...'
        )
    ),
)

@pytest.mark.parametrize(("line", "exp_search_term"), ERROR_LINE_TEST_CASES)
def test_get_error_search_term(line, exp_search_term):
    """tests the search term extracted from an error line is correct"""

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
)

#command timed out: 2400 seconds without output running ['/tools/buildbot/bin/python', 'scripts/scripts/android_emulator_unittest.py', '--cfg', 'android/androidx86.py', '--test-suite', 'robocop-1', '--test-suite', 'robocop-2', '--test-suite', 'robocop-3', '--test-suite', 'xpcshell', '--blob-upload-branch', 'b2g-inbound', '--download-symbols', 'ondemand'], attempting to kill

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
