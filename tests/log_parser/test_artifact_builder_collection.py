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
    assert len(lpc.builders) == 2


def test_all_builders_complete():
    """test no builders"""
    log = "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    url = "file://{0}".format(
        SampleData().get_log_path("{0}.txt.gz".format(log)))
    lpc = ArtifactBuilderCollection(
        url,
    )
    for builder in lpc.builders:
        for parser in builder.parsers:
            parser.parse_complete = True

    lpc.parse()
    exp = {
        "Structured Log": {
            "header": {},
            "logurl": "file:///home/vagrant/treeherder-service/tests/sample_data/logs/mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50.txt.gz",
            "step_data": {
                "all_errors": [],
                "steps": []
            }
        },
        "Unknown Builder Job Artifact": {
            "errors": [],
            "logurl": "file:///home/vagrant/treeherder-service/tests/sample_data/logs/mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50.txt.gz",
            "tinderbox_printlines": []
        }
    }

    assert lpc.artifacts == exp