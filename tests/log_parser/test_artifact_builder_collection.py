import pytest
import responses

from tests.test_utils import add_log_response
from treeherder.log_parser.artifactbuildercollection import (
    MAX_DOWNLOAD_SIZE_IN_BYTES,
    ArtifactBuilderCollection,
    LogSizeError,
)
from treeherder.log_parser.artifactbuilders import LogViewerArtifactBuilder


def test_builders_as_list():
    """test that passing in a list of builders works"""
    builder = LogViewerArtifactBuilder()
    lpc = ArtifactBuilderCollection("foo-url", builders=[builder])
    assert lpc.builders == [builder]


def test_builders_as_single_still_list():
    """test that passing in a single builder becomes a list"""
    builder = LogViewerArtifactBuilder()
    lpc = ArtifactBuilderCollection("foo-url", builders=builder)
    assert lpc.builders == [builder]


def test_default_builders():
    """test no builders"""
    lpc = ArtifactBuilderCollection(
        "foo-url",
    )
    assert isinstance(lpc.builders, list)
    assert len(lpc.builders) == 2


@responses.activate
def test_all_builders_complete():
    """test when parse.complete is true creates correct structure"""
    url = add_log_response("win-aarch64-build.txt.gz")
    lpc = ArtifactBuilderCollection(url)
    for builder in lpc.builders:
        builder.parser.complete = True

    lpc.parse()
    exp = {
        "text_log_summary": {
            "errors": [],
            "logurl": url,
        },
    }

    assert exp == lpc.artifacts


@responses.activate
def test_log_download_size_limit():
    """Test that logs whose Content-Length exceed the size limit are not parsed."""
    url = "http://foo.tld/fake_large_log.tar.gz"
    responses.add(
        responses.GET,
        url,
        body="",
        adding_headers={
            "Content-Encoding": "gzip",
            "Content-Length": str(MAX_DOWNLOAD_SIZE_IN_BYTES + 1),
        },
    )
    lpc = ArtifactBuilderCollection(url)

    with pytest.raises(LogSizeError):
        lpc.parse()
