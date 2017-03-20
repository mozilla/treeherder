import responses
from datadiff import diff

from tests.test_utils import add_log_response
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotLogViewArtifactBuilder


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


@responses.activate
def test_all_builders_complete():
    """test when parse.complete is true creates correct structure"""
    url = add_log_response(
        "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50.txt.gz"
    )
    lpc = ArtifactBuilderCollection(url)
    for builder in lpc.builders:
        builder.parser.complete = True

    lpc.parse()
    exp = {
        "text_log_summary": {
            "step_data": {
                "steps": [],
                "errors_truncated": False
            },
            "logurl": url,
        },
        "Job Info": {
            "job_details": [],
            "logurl": url,
        }
    }

    assert exp == lpc.artifacts, diff(exp, lpc.artifacts)
