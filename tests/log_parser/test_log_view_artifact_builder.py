import pytest

from tests import test_utils
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotLogViewArtifactBuilder


from tests.test_utils import add_log_response

slow = pytest.mark.slow

logs = [
    "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50",
    "mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141",
    "mozilla-central-win32-pgo-bm85-build1-build111",
    # Test a mochitest log that has PROCESS-CRASH
    "mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122",
    "xpcshell-crash",
    "xpcshell-multiple",
    "xpcshell-timeout",
    # This log has lines that are huge.  Ensure we truncate the lines to 100
    "mozilla-central_ubuntu64_hw_test-androidx86-set-4-bm103-tests1-linux-build369",
    # This log has a large number of lines that match the error regex. Ensure we truncate to 100 lines.
    "large-number-of-error-lines",
    # A log from a Taskcluster job, where there was an infrastructure problem,
    # and so the final step finish marker is missing. There is also log content
    # between the step markers that should result in unnamed steps being created
    # to house any errors within them.
    "taskcluster-missing-finish-step-marker",
    # new file
    "mozilla-central-win32-pgo-bm74-build1-build19"
]

slow_logs = [
    "mozilla-esr17_xp_test_pgo-mochitest-browser-chrome-bm74-tests1-windows-build12",
    "ux_ubuntu32_vm_test-jetpack-bm67-tests1-linux-build16",
    "crash-1",
    "crash-2",
    "crash-mac-1",
    "crashtest-timeout",
    "jsreftest-fail",
    "jsreftest-timeout-crash",
    "leaks-1",
    "mochitest-test-end",
    "multiple-timeouts",
    "opt-objc-exception",
    "reftest-fail-crash",
    "reftest-jserror",
    "reftest-opt-fail",
    "reftest-timeout",
    "tinderbox-exception",
]


@pytest.mark.parametrize(('log'), logs)
def test_logs(log, activate_responses):
    do_log_view_log_parse(log)


@slow
@pytest.mark.parametrize(('log'), slow_logs)
def test_slow_logs(log, activate_responses):
    do_log_view_log_parse(log)


def do_log_view_log_parse(log):
    """
    Test a single log.

    ``log`` - the url prefix of the log to test.  Also searches for the
              result file with the same prefix.
    """

    url = add_log_response("{0}.txt.gz".format(log), 20000)

    builder = BuildbotLogViewArtifactBuilder(url)
    lpc = ArtifactBuilderCollection(url, builders=builder)
    lpc.parse()
    act = lpc.artifacts[builder.name]
    exp = test_utils.load_exp("{0}.logview.json".format(log))

    # :: Uncomment to create the ``exp`` files, if you're making a lot of them
    # import json
    # from tests.sampledata import SampleData
    # with open(SampleData().get_log_path("{0}.logview.json".format(log)), "w") as f:
    #     f.write(json.dumps(act, indent=4))

    # we can't compare the "logurl" field, because it's a fully qualified url,
    # so it will be different depending on the machine it's run on.
    assert "logurl" in act
    del(act["logurl"])

    # log urls won't match in tests, since they're machine specific
    # but leave it in the exp file as an example of what the real structure
    # should look like.
    del(exp["logurl"])

    assert exp == act # , diff(exp, act)

    # :: Use this assert when creating new tests and you want to get the actual
    # returned artifact:
    # assert act == exp, json.dumps(act, indent=4)

