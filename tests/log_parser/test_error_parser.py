import pytest

from treeherder.log_parser.parsers import ErrorParser

ERROR_TEST_CASES = (
    "23:52:39 INFO - 346 INFO TEST-UNEXPECTED-FAIL | dom/base/test/test_XHRDocURI.html | foo",
    "00:54:55 WARNING - PROCESS-CRASH | Shutdown | application crashed [@ PR_GetThreadPrivate]",
    "23:57:52 INFO - Remote Device Error: Unhandled exception in cleanupDevice",
    "23:57:52 ERROR - Return code: 1",
    "23:57:52 CRITICAL - Preparing to abort run due to failed verify check.",
    "23:57:52 FATAL - Dying due to failing verification",
    "remoteFailed: [Failure instance: Traceback (failure with no frames): Foo.",
    "08:13:37 INFO - make: *** [test-integration-test] Error 1",
    "pymake\..\..\mozmake.exe: *** [buildsymbols] Error 11",
    "00:55:13 INFO - SUMMARY: AddressSanitizer: 64 byte(s) leaked in 1 allocation(s).",
    "Automation Error: Foo bar",
    "[taskcluster] Error: Task run time exceeded 7200 seconds.",
    "foo.js: line 123, col 321, Error - ESLint bar",
    "2014-04-04 06:37:57 ERROR 403: Forbidden.",
    "[taskcluster:error] Could not upload artifact",
    "[taskcluster-vcs:error] Could not extract archive"
)

NON_ERROR_TEST_CASES = (
    "TEST-PASS | foo | bar",
    "07:42:02     INFO -  Exception:",
    "07:51:08     INFO -  Caught Exception: Remote Device Error: unable to connect to panda-0501 after 5 attempts",
    "06:21:18     INFO -  I/GeckoDump(  730): 110 INFO TEST-UNEXPECTED-FAIL | foo | bar",
    "[taskcluster:info] Starting task",
    "[taskcluster] Starting task"
)


@pytest.mark.parametrize("line", ERROR_TEST_CASES)
def test_error_lines_matched(line):
    parser = ErrorParser()
    is_error_line = parser.is_error_line(line)
    assert is_error_line


@pytest.mark.parametrize("line", NON_ERROR_TEST_CASES)
def test_successful_lines_not_matched(line):
    parser = ErrorParser()
    is_error_line = parser.is_error_line(line)
    assert not is_error_line
