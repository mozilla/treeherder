import pytest
import requests
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


@responses.activate
def test_parse_uses_large_iter_lines_chunk(monkeypatch):
    """`iter_lines()` with its default 512-byte chunk is quadratic on long lines,
    so the log must be streamed with the shared large chunk size."""
    from treeherder.utils.http import ITER_LINES_CHUNK_SIZE

    seen = {}
    original = requests.Response.iter_lines

    def spy(self, *args, **kwargs):
        seen.update(kwargs)
        return original(self, *args, **kwargs)

    monkeypatch.setattr(requests.Response, "iter_lines", spy)
    url = add_log_response("win-aarch64-build.txt.gz")

    ArtifactBuilderCollection(url).parse()

    assert seen == {"chunk_size": ITER_LINES_CHUNK_SIZE}
