import pytest

from treeherder.etl.taskcluster_pulse.parse_route import parse_route


@pytest.mark.parametrize(
    "route,project,revision,id",
    [
        (
            "tc-treeherder.v1.mozilla-central.abc123def456.789",
            "mozilla-central",
            "abc123def456",
            789,
        ),
        ("tc-treeherder.v1.mozilla-mobile/fenix.abc123def456.789", "fenix", "abc123def456", 789),
        ("tc-treeherder.v1.try.abc123def456", "try", "abc123def456", 0),
    ],
)
def test_parse_route_v1(route, project, revision, id):
    result = parse_route(route)
    assert result["version"] == "v1"
    assert result["destination"] == "tc-treeherder"
    assert result["project"] == project
    assert result["revision"] == revision
    assert result["id"] == id
    assert "origin" not in result


@pytest.mark.parametrize(
    "route,branch,revision,id",
    [
        (
            "tc-treeherder.v2.firefox-ci.enterprise-firefox.main.abc123def456.789",
            "main",
            "abc123def456",
            789,
        ),
        (
            "tc-treeherder.v2.firefox-ci.enterprise-firefox.release.abc123def456",
            "release",
            "abc123def456",
            0,
        ),
    ],
)
def test_parse_route_v2(route, branch, revision, id):
    result = parse_route(route)
    assert result["version"] == "v2"
    assert result["destination"] == "tc-treeherder"
    assert result["trust_domain"] == "firefox-ci"
    assert result["project"] == "enterprise-firefox"
    assert result["branch"] == branch
    assert result["revision"] == revision
    assert result["id"] == id
    assert "origin" not in result


@pytest.mark.parametrize(
    "route",
    [
        "tc-treeherder.v3.mozilla-central.abc123.789",
        "tc-treeherder.v1.mozilla-central",
        "tc-treeherder.v2.firefox-ci.enterprise-firefox.main",
    ],
)
def test_parse_route_invalid(route):
    with pytest.raises(ValueError):
        parse_route(route)
