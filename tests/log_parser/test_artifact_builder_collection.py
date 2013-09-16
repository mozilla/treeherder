from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotLogViewArtifactBuilder
from ..sampledata import SampleData
from datadiff import diff


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
    assert len(lpc.builders) == 2


def test_check_errors_false():
    """test for passing case"""
    abc = ArtifactBuilderCollection(
        "foo-url",
        check_errors=False
    )

    assert abc.builders[0].parsers[1].sub_parser.check_errors is False


def test_all_builders_complete():
    """test when parse.complete is true creates correct structure"""
    log = "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    url = "file://{0}".format(
        SampleData().get_log_path("{0}.txt.gz".format(log)))
    lpc = ArtifactBuilderCollection(
        url,
    )
    for builder in lpc.builders:
        for parser in builder.parsers:
            parser.complete = True

    lpc.parse()
    exp = {
        "Structured Log": {
            "header": {},
            "step_data": {
                "all_errors": [],
                "steps": []
            }
        },
        "Unknown Builder Job Artifact": {
            "tinderbox_printlines": []
        }
    }
    act = lpc.artifacts

    # we can't compare the "logurl" field, because it's a fully qualified url,
    # so it will be different depending on the config it's run in.
    assert "logurl" in act["Structured Log"]
    assert "logurl" in act["Unknown Builder Job Artifact"]
    del(act["Unknown Builder Job Artifact"]["logurl"])
    del(act["Structured Log"]["logurl"])

    assert exp == lpc.artifacts, diff(exp, lpc.artifacts)
