from datadiff import diff

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotLogViewArtifactBuilder

from ..sampledata import SampleData


def test_builders_as_list():
    """test that passing in a list of builders works"""
    builder = BuildbotLogViewArtifactBuilder()
    lpc = ArtifactBuilderCollection(
        "foo-url",
        builders=[builder]
    )
    assert lpc.builders == [builder]


def test_builders_as_single_still_list():
    """test that passing in a single builder becomes a list"""
    builder = BuildbotLogViewArtifactBuilder()
    lpc = ArtifactBuilderCollection(
        "foo-url",
        builders=builder
    )
    assert lpc.builders == [builder]


def test_default_builders():
    """test no builders"""
    lpc = ArtifactBuilderCollection(
        "foo-url",
    )
    assert isinstance(lpc.builders, list)
    assert len(lpc.builders) == 3


def test_all_builders_complete():
    """test when parse.complete is true creates correct structure"""
    log = "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    url = "file://{0}".format(
        SampleData().get_log_path("{0}.txt.gz".format(log)))
    lpc = ArtifactBuilderCollection(
        url,
    )
    for builder in lpc.builders:
        builder.parser.complete = True

    lpc.parse()
    exp = {
        "text_log_summary": {
            "step_data": {
                "steps": [],
                "errors_truncated": False
            },
        },
        "Job Info": {
            "job_details": []
        }
    }
    act = lpc.artifacts

    # we can't compare the "logurl" field, because it's a fully qualified url,
    # so it will be different depending on the config it's run in.
    assert "logurl" in act["text_log_summary"]
    assert "logurl" in act["Job Info"]
    del(act["Job Info"]["logurl"])
    del(act["text_log_summary"]["logurl"])

    assert exp == lpc.artifacts, diff(exp, lpc.artifacts)
