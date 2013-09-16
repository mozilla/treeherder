import json
from datadiff import diff

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotLogViewArtifactBuilder
from treeherder.log_parser.parsers import ErrorParser

from tests import test_utils
from ..sampledata import SampleData


def do_test(log, check_errors=True):
    """
    Test a single log.

    ``log`` - the url prefix of the log to test.  Also searches for the
              result file with the same prefix.
    """

    url = "file://{0}".format(
        SampleData().get_log_path("{0}.txt.gz".format(log)))

    builder = BuildbotLogViewArtifactBuilder(url, check_errors=check_errors)
    lpc = ArtifactBuilderCollection(url, builders=builder)
    lpc.parse()
    act = lpc.artifacts[builder.name]

    # we can't compare the "logurl" field, because it's a fully qualified url,
    # so it will be different depending on the config it's run in.
    assert "logurl" in act
    del(act["logurl"])

    exp = test_utils.load_exp("{0}.logview.json".format(log))

    # :: use to create the ``exp`` files, if you're making a lot of them
    # with open(SampleData().get_log_path("{0}.logview.json".format(log)), "w") as f:
    #     f.write(json.dumps(act, indent=4))
    #     f.close()

    # log urls won't match in tests, since they're machine specific
    # but leave it in the exp file as an example of what the real structure
    # should look like.
    del(exp["logurl"])

    assert act == exp, diff(exp, act)

    # :: Use this assert when creating new tests and you want to get the actual
    # returned artifact:
    # assert act == exp, json.dumps(act, indent=4)


def test_crashtest_passing(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    )


def test_mochitest_pass(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141"
    )


def test_mochitest_fail(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "mozilla-esr17_xp_test_pgo-mochitest-browser-chrome-bm74-tests1-windows-build12"
    )


def test_mochitest_process_crash(jm, initial_data):
    """Test a mochitest log that has PROCESS-CRASH """

    do_test(
        "mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122"
    )


def test_jetpack_fail(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "ux_ubuntu32_vm_test-jetpack-bm67-tests1-linux-build16"
    )


def test_crash_1(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "crash-1"
    )


def test_crash_2(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "crash-2"
    )


def test_crash_mac_1(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "crash-mac-1"
    )


def test_crashtest_timeout(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "crashtest-timeout"
    )


def test_jsreftest_fail(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "jsreftest-fail"
    )


def test_jsreftest_timeout_crash(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "jsreftest-timeout-crash"
    )


def test_leaks_1(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "leaks-1"
    )


def test_mochitest_test_end(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "mochitest-test-end"
    )


def test_multiple_timeouts(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "multiple-timeouts"
    )


def test_opt_objc_exception(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "opt-objc-exception"
    )


def test_reftest_fail_crash(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "reftest-fail-crash"
    )


def test_reftest_jserror(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "reftest-jserror"
    )


def test_reftest_opt_fail(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "reftest-opt-fail"
    )


def test_reftest_timeout(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "reftest-timeout"
    )


def test_tinderbox_exception(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "tinderbox-exception"
    )


def test_xpcshell_crash(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "xpcshell-crash"
    )


def test_xpcshell_multiple(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "xpcshell-multiple"
    )


def test_xpcshell_timeout(jm, initial_data):
    """Test from old log parser"""
    do_test(
        "xpcshell-timeout"
    )

def test_check_errors_false(jm, initial_data, monkeypatch):
    """ensure that parse_line is not called on the error parser."""

    called = False
    def mock_pl():
        called = True
    monkeypatch.setattr(ErrorParser, 'parse_line', mock_pl)

    do_test(
        "mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141",
        check_errors=False
    )
    assert called is False
