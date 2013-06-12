import json
from datadiff import diff

from treeherder.log_parser.logparsecollection import LogParseCollection
from treeherder.log_parser.jobartifactparser import BuildbotJobArtifactParser
from ..sampledata import SampleData
from tests import test_utils


def do_test(job_type, log):
    """
    Test a single log with the ``JobArtifactParser``.

    ``job_type`` - Something like "mochitest", "crashtest" or "reftest"
    ``log`` - the url prefix of the log to test.  Also searches for the
              result file with the same prefix.
    """

    url = "file://{0}".format(
        SampleData().get_log_path("{0}.txt.gz".format(log)))
    exp = test_utils.load_exp("{0}.logartifact.json".format(log))

    jap = BuildbotJobArtifactParser(job_type, url)
    lpc = LogParseCollection(url, parsers=jap)
    lpc.parse()
    act = lpc.artifacts[jap.name]
    assert act == exp, diff(exp, act)

    # if you want to gather results for a new test, use this
    # assert act == exp, json.dumps(act, indent=4)


def test_crashtest_passing(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "crashtest",
        "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    )


def test_build_failing(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "build",
        "mozilla-central-macosx64-debug-bm65-build1-build15"
    )


def xtest_mochitest_debug_passing(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "mochitest",
        "mozilla-central_mountainlion-debug_test-mochitest-2-bm80-tests1-macosx-build93"
    )


def xtest_mochitest_pass(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "mochitest",
        "mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141"
    )


def xtest_mochitest_fail(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "mochitest",
        "mozilla-esr17_xp_test_pgo-mochitest-browser-chrome-bm74-tests1-windows-build12"
    )


def xtest_mochitest_process_crash(jm, initial_data):
    """Test a mochitest log that has PROCESS-CRASH """

    do_test(
        "mochitest",
        "mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122"
    )


def xtest_jetpack_fail(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "jetpack",
        "ux_ubuntu32_vm_test-jetpack-bm67-tests1-linux-build16"
    )
