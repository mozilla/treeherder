from tests import test_utils
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotJobArtifactBuilder

from ..sampledata import SampleData


def do_test(log):
    """
    Test a single log with the ``JobArtifactBuilder``.

    ``log`` - the url prefix of the log to test.  Also searches for the
              result file with the same prefix.
    """

    url = "file://{0}".format(
        SampleData().get_log_path("{0}.txt.gz".format(log)))
    exp = test_utils.load_exp("{0}.jobartifact.json".format(log))

    builder = BuildbotJobArtifactBuilder(url)
    lpc = ArtifactBuilderCollection(url, builders=builder)
    lpc.parse()
    act = lpc.artifacts[builder.name]

    # we can't compare the "logurl" field, because it's a fully qualified url,
    # so it will be different depending on the config it's run in.
    assert "logurl" in act
    del(act["logurl"])
    # leaving the logurl in the exp files so they are a good example of the
    # expected structure.
    del(exp["logurl"])
    # assert act == exp, diff(exp, act)

    # if you want to gather results for a new test, use this
    assert len(act) == len(exp)
    for index, artifact in act.items():
        assert artifact == exp[index]

    # assert act == exp#, json.dumps(act, indent=4)


def test_crashtest_passing(initial_data):
    """Process a job with a single log reference."""

    do_test("mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50")


def test_opt_test_failing(initial_data):
    """Process log with printlines and errors"""
    do_test("mozilla-central_mountainlion_test-mochitest-2-bm80-tests1-macosx-build138")


def test_build_failing(initial_data):
    """Process a job with a single log reference."""

    do_test("mozilla-central-macosx64-debug-bm65-build1-build15")


def test_mochitest_debug_passing(initial_data):
    """Process a job with a single log reference."""

    do_test("mozilla-central_mountainlion-debug_test-mochitest-2-bm80-tests1-macosx-build93")


def test_mochitest_pass(initial_data):
    """Process a job with a single log reference."""

    do_test("mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141")


def test_mochitest_fail(initial_data):
    """Process a job with a single log reference."""

    do_test("mozilla-esr17_xp_test_pgo-mochitest-browser-chrome-bm74-tests1-windows-build12")


def test_mochitest_process_crash(initial_data):
    """Test a mochitest log that has PROCESS-CRASH """

    do_test("mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122")


def test_jetpack_fail(initial_data):
    """Process a job with a single log reference."""

    do_test("ux_ubuntu32_vm_test-jetpack-bm67-tests1-linux-build16")
