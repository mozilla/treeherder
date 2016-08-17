import pytest
from tests import test_utils
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotJobArtifactBuilder

from tests.test_utils import add_log_response


logs = [
    "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50",
    "mozilla-central_mountainlion_test-mochitest-2-bm80-tests1-macosx-build138",
    "mozilla-central-macosx64-debug-bm65-build1-build15",
    "mozilla-central_mountainlion-debug_test-mochitest-2-bm80-tests1-macosx-build93",
    "mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141",
    "mozilla-esr17_xp_test_pgo-mochitest-browser-chrome-bm74-tests1-windows-build12",
    "mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122",
    "ux_ubuntu32_vm_test-jetpack-bm67-tests1-linux-build16"
    ]


@pytest.mark.parametrize(('log'), logs)
def test_job_artifact_log_parse(log, activate_responses):
    """
    Test a single log with the ``JobArtifactBuilder``.

    ``log`` - the url prefix of the log to test.  Also searches for the
              result file with the same prefix.
    """

    url = add_log_response("{0}.txt.gz".format(log), 20000)
    exp = test_utils.load_exp("{0}.jobartifact.json".format(log))

    builder = BuildbotJobArtifactBuilder(url)
    lpc = ArtifactBuilderCollection(url, builders=builder)
    lpc.parse()
    act = lpc.artifacts[builder.name]

    # we can't compare the "logurl" field, because of mocking it with responses
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
