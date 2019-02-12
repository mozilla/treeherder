import responses

from tests import test_utils
from tests.test_utils import add_log_response
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotJobArtifactBuilder


@responses.activate
def do_test(log):
    """
    Test a single log with the ``JobArtifactBuilder``.

    ``log`` - the url prefix of the log to test.  Also searches for the
              result file with the same prefix.
    """

    url = add_log_response("{}.txt.gz".format(log))

    builder = BuildbotJobArtifactBuilder(url)
    lpc = ArtifactBuilderCollection(url, builders=builder)
    lpc.parse()
    act = lpc.artifacts[builder.name]

    # :: Uncomment to create the ``exp`` files
    # import json
    # from tests.sampledata import SampleData
    # with open(SampleData().get_log_path("{0}.jobartifact.json".format(log)), "w") as f:
    #     f.write(json.dumps(act, indent=2))

    exp = test_utils.load_exp("{0}.jobartifact.json".format(log))

    assert len(act) == len(exp)
    for index, artifact in act.items():
        assert artifact == exp[index]


def test_crashtest_passing():
    """Process a job with a single log reference."""

    do_test("mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50")


def test_opt_test_failing():
    """Process log with printlines and errors"""
    do_test("mozilla-central_mountainlion_test-mochitest-2-bm80-tests1-macosx-build138")


def test_build_failing():
    """Process a job with a single log reference."""

    do_test("mozilla-central-macosx64-debug-bm65-build1-build15")


def test_mochitest_debug_passing():
    """Process a job with a single log reference."""

    do_test("mozilla-central_mountainlion-debug_test-mochitest-2-bm80-tests1-macosx-build93")


def test_mochitest_pass():
    """Process a job with a single log reference."""

    do_test("mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141")


def test_mochitest_fail():
    """Process a job with a single log reference."""

    do_test("mozilla-esr17_xp_test_pgo-mochitest-browser-chrome-bm74-tests1-windows-build12")


def test_mochitest_process_crash():
    """Test a mochitest log that has PROCESS-CRASH """

    do_test("mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122")


def test_jetpack_fail():
    """Process a job with a single log reference."""

    do_test("ux_ubuntu32_vm_test-jetpack-bm67-tests1-linux-build16")
