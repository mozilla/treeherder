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

    url = add_log_response(f"{log}.log.gz")

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
    do_test("mochitest-fail")


def test_mochitest_process_crash():
    """Test a mochitest log that has PROCESS-CRASH"""
    do_test("mochitest-crash")


def test_wpt_multiple():
    do_test("wpt-multiple")


def test_build_failure():
    do_test("build-fail")


def test_xpcshell_crash():
    do_test("xpcshell-crash")


def test_win_crash():
    do_test("windows-stuff")


def test_crashtest_timeout():
    do_test("crashtest-timeout")


def test_leaks_1():
    """Test from old log parser"""
    do_test("leak")


def test_mochitest_test_end():
    do_test("mochitest-end")


def test_reftest_fail():
    do_test("reftest-fail")


def test_reftest_timeout():
    do_test("reftest-timeout")


def test_timeout_crash():
    do_test("timeout-crash")


def test_taskcuster_timeout():
    do_test("taskcluster-timeout")


def test_asan_too_large():
    do_test("asan_too_large")


def test_too_many_error_lines_truncation():
    """This log has a large number of lines that match the error regex. Ensure we truncate to 100 lines."""
    do_test("too_many_failures")


def test_taskcluster_missing_finish_marker():
    """
    A log from a Taskcluster job, where there was an infrastructure problem,
    and so the final step finish marker is missing. There is also log content
    between the step markers that should result in unnamed steps being created
    to house any errors within them.
    """
    do_test("taskcluster-only")
