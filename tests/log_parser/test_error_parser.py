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
    r"pymake\..\..\mozmake.exe: *** [buildsymbols] Error 11",
    r"pymake\..\..\mozmake.EXE: *** [buildsymbols] Error 11",
    "00:55:13 INFO - SUMMARY: AddressSanitizer: 64 byte(s) leaked in 1 allocation(s).",
    "Automation Error: Foo bar",
    "[taskcluster] Error: Task run time exceeded 7200 seconds.",
    "foo.js: line 123, col 321, Error - ESLint bar",
    "2014-04-04 06:37:57 ERROR 403: Forbidden.",
    "[taskcluster:error] Could not upload artifact",
    "[taskcluster-vcs:error] Could not extract archive",
    "[test_linux.sh:error] could not download zip file",
    "14:15:32     INFO -  REFTEST ERROR | file:///Z:/task_1491573689/build/tests/reftest/tests/layout/reftests/w3c-css/submitted/text3/text-justify-inter-character-001.html | application timed out after 330 seconds with no output",
)

NON_ERROR_TEST_CASES = (
    "TEST-PASS | foo | bar",
    "07:42:02     INFO -  Exception:",
    "07:51:08     INFO -  Caught Exception: Remote Device Error: unable to connect to panda-0501 after 5 attempts",
    "06:21:18     INFO -  I/GeckoDump(  730): 110 INFO TEST-UNEXPECTED-FAIL | foo | bar",
    "[taskcluster:info] Starting task",
    "[taskcluster] Starting task",
    "01:22:41     INFO -  ImportError: No module named pygtk",
    "01:22:41     INFO -  ImportError: No module named pygtk\r\n"
)


@pytest.mark.parametrize("line", ERROR_TEST_CASES)
def test_error_lines_matched(line):
    parser = ErrorParser()
    is_error_line = parser.is_error_line(line)
    assert is_error_line

    # Now feed the line into the parser and verify we still find an error.
    parser.parse_line(line, 1)
    assert len(parser.artifact) == 1


@pytest.mark.parametrize("line", ERROR_TEST_CASES)
def test_error_lines_taskcluster(line):
    parser = ErrorParser()
    # Make the log parser think this is a TaskCluster log.
    parser.parse_line('[taskcluster foo] this is a taskcluster log', 1)
    assert parser.is_taskcluster
    parser.parse_line(line, 2)
    assert len(parser.artifact) == 1


@pytest.mark.parametrize("line", NON_ERROR_TEST_CASES)
def test_successful_lines_not_matched(line):
    parser = ErrorParser()
    is_error_line = parser.is_error_line(line)
    assert not is_error_line


def test_taskcluster_strip_prefix():
    parser = ErrorParser()
    assert not parser.is_taskcluster
    assert not parser.artifact

    # Prefix should not be stripped unless we see a
    # [taskcluster...] line. Not stripping the prefix causes error parsing to
    # fail.
    parser.parse_line("[vcs 2016-09-07T19:03:02.188327Z] 23:57:52 ERROR - Return code: 1", 1)
    assert not parser.is_taskcluster
    assert not parser.artifact

    # Parsing a line with the [taskcluster...] prefix marks the log as
    # associated with TC.
    parser.parse_line("[taskcluster 2016-09-07 19:02:55.114Z] Task ID: PWden6jYS4SfVKYj4p7y6w", 2)
    assert parser.is_taskcluster
    assert not parser.artifact

    # And parsing the same line as above should detect the error since the
    # TC prefix is stripped.
    parser.parse_line("[vcs 2016-09-07T19:03:02.188327Z] 23:57:52 ERROR - Return code: 1", 3)
    assert len(parser.artifact) == 1
    assert parser.artifact[0]['linenumber'] == 3
