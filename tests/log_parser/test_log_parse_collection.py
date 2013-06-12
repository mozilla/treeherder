import pytest

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.logviewartifactbuilder import BuildbotLogViewArtifactBuilder


def test_parsers_as_list():
    """test that passing in a list of parsers works"""
    parser = BuildbotLogViewArtifactBuilder("mochitest")
    lpc = ArtifactBuilderCollection(
        "foo-url",
        "mochitest",
        parsers=[parser]
    )
    assert lpc.parsers == [parser]


def test_parsers_as_single_still_list():
    """test that passing in a single parser becomes a list"""
    parser = BuildbotLogViewArtifactBuilder("mochitest")
    lpc = ArtifactBuilderCollection(
        "foo-url",
        "mochitest",
        parsers=parser
    )
    assert lpc.parsers == [parser]


def test_default_parsers():
    """test that passing in a job_type instead of a parser"""
    parser = BuildbotLogViewArtifactBuilder("mochitest")
    lpc = ArtifactBuilderCollection(
        "foo-url",
        "mochitest",
    )
    assert isinstance(lpc.parsers, list)
    assert len(lpc.parsers) == 1
    assert lpc.parsers[0].name == parser.name


def test_bad_values():
    """test that passing in a single parser becomes a list"""

    with pytest.raises(ValueError) as e:
        lpc = ArtifactBuilderCollection(
            "foo-url",
        )

    assert e.exconly() == "ValueError: Must provide either ``job_type`` or ``parsers``"
