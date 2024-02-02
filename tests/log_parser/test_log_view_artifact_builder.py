import pytest
import responses

from tests import test_utils
from tests.test_utils import add_log_response
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import LogViewerArtifactBuilder

skip = pytest.mark.skip


@responses.activate
def do_test(log):
    """
    Test a single log.

    ``log`` - the url prefix of the log to test.  Also searches for the
              result file with the same prefix.
    """

    url = add_log_response(f"{log}.txt.gz")

    builder = LogViewerArtifactBuilder(url)
    lpc = ArtifactBuilderCollection(url, builders=builder)
    lpc.parse()
    act = lpc.artifacts[builder.name]

    # :: Uncomment to create the ``exp`` files
    # import json
    # from tests.sampledata import SampleData
    # with open(SampleData().get_log_path("{0}.logview.json".format(log)), "w") as f:
    #     f.write(json.dumps(act, indent=2))

    exp = test_utils.load_exp(f"{log}.logview.json")

    assert act == exp


def test_mochitest_fail():
    """Process a job with a single log reference."""

    do_test("mozilla-esr17_xp_test_pgo-mochitest-browser-chrome-bm74-tests1-windows-build12")


def test_mochitest_process_crash():
    """Test a mochitest log that has PROCESS-CRASH"""

    do_test("mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122")


def test_crash_1():
    """Test from old log parser"""
    do_test("crash-1")


def test_opt_objc_exception():
    """Test from old log parser"""
    do_test("opt-objc-exception")


def test_jsreftest_fail():
    """Test from old log parser"""
    do_test("jsreftest-fail")


# TODO remove old tests and update active tests with current live backing logs
@skip
def test_jetpack_fail():
    """Process a job with a single log reference."""

    do_test("ux_ubuntu32_vm_test-jetpack-bm67-tests1-linux-build16")


@skip
def test_crash_2():
    """Test from old log parser"""
    do_test("crash-2")


@skip
def test_crash_mac_1():
    """Test from old log parser"""
    do_test("crash-mac-1")


@skip
def test_crashtest_timeout():
    """Test from old log parser"""
    do_test("crashtest-timeout")


@skip
def test_jsreftest_timeout_crash():
    """Test from old log parser"""
    do_test("jsreftest-timeout-crash")


@skip
def test_leaks_1():
    """Test from old log parser"""
    do_test("leaks-1")


@skip
def test_mochitest_test_end():
    """Test from old log parser"""
    do_test("mochitest-test-end")


@skip
def test_multiple_timeouts():
    """Test from old log parser"""
    do_test("multiple-timeouts")


@skip
def test_reftest_fail_crash():
    """Test from old log parser"""
    do_test("reftest-fail-crash")


@skip
def test_reftest_jserror():
    """Test from old log parser"""
    do_test("reftest-jserror")


@skip
def test_reftest_opt_fail():
    """Test from old log parser"""
    do_test("reftest-opt-fail")


@skip
def test_reftest_timeout():
    """Test from old log parser"""
    do_test("reftest-timeout")


@skip
def test_tinderbox_exception():
    """Test from old log parser"""
    do_test("tinderbox-exception")


@skip
def test_xpcshell_crash():
    """Test from old log parser"""
    do_test("xpcshell-crash")


@skip
def test_xpcshell_multiple():
    """Test from old log parser"""
    do_test("xpcshell-multiple")


@skip
def test_xpcshell_timeout():
    """Test from old log parser"""
    do_test("xpcshell-timeout")


@skip
# This test is not actually testing truncation of lines - remove
def test_extreme_log_line_length_truncation():
    """This log has lines that are huge.  Ensure we truncate the lines to 100"""
    do_test("mozilla-central_ubuntu64_hw_test-androidx86-set-4-bm103-tests1-linux-build369")


@skip
def test_too_many_error_lines_truncation():
    """This log has a large number of lines that match the error regex. Ensure we truncate to 100 lines."""
    do_test("large-number-of-error-lines")


@skip
def test_taskcluster_missing_finish_marker():
    """
    A log from a Taskcluster job, where there was an infrastructure problem,
    and so the final step finish marker is missing. There is also log content
    between the step markers that should result in unnamed steps being created
    to house any errors within them.
    """
    do_test("taskcluster-missing-finish-step-marker")
