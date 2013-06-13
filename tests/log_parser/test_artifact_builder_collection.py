import pytest

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
    assert len(lpc.builders) == 2
