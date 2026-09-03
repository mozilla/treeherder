from types import SimpleNamespace

from treeherder.etl.management.commands import ingest

REPO_META = {
    "owner": "o",
    "repo": "r",
    "branch": "main",
    "url": "https://github.com/o/r",
    "tc_root_url": "https://tc.example.com",
}


def _git_user(name=None, email=None, date=None):
    return SimpleNamespace(name=name, email=email, date=date)


def _commit(sha, *, message=None, author=None, committer=None, parents=None):
    return SimpleNamespace(
        sha=sha,
        commit=SimpleNamespace(message=message, author=author, committer=committer),
        parents=parents or [],
    )


def test_query_data_uses_pygithub_comparison(monkeypatch):
    """query_data reads a PyGithub Comparison (Bug 2009865: not a REST dict).

    compare_shas still returns commit objects for the Pulse push loader; ingest
    uses get_comparison for merge_base_commit / parents / commits.
    """
    parent = _commit("PARENT")
    merge_base = _commit(
        "BASE",
        committer=_git_user(date="2026-01-01T00:00:00Z"),
        parents=[parent],
    )
    head_commit = _commit(
        "C1",
        message="Fix the thing",
        author=_git_user(name="Dev", email="dev@example.com"),
        committer=_git_user(date="2026-02-02T00:00:00Z"),
    )

    comparisons = {
        ("main", "HEAD"): SimpleNamespace(merge_base_commit=merge_base, commits=[]),
        ("PARENT", "HEAD"): SimpleNamespace(
            merge_base_commit=_commit("PARENT", parents=[]),
            commits=[head_commit],
        ),
    }

    def fake_get_comparison(owner, repo, base, head):
        assert owner == "o" and repo == "r"
        return comparisons[(base, head)]

    def fake_get_commit(owner, repo, sha):
        assert sha == "PARENT"
        # Different committer date from the merge base so query_data takes
        # the simple (non-recursive) branch.
        return {"sha": "PARENT", "commit": {"committer": {"date": "2026-02-02T00:00:00Z"}}}

    monkeypatch.setattr(ingest, "get_comparison", fake_get_comparison)
    monkeypatch.setattr(ingest, "get_commit", fake_get_commit)

    event_base_sha, commits = ingest.query_data(REPO_META, "HEAD")

    assert event_base_sha == "PARENT"
    assert commits == [
        {
            "message": "Fix the thing",
            "author": {"name": "Dev", "email": "dev@example.com"},
            "committer": {"name": None, "email": None, "date": "2026-02-02T00:00:00Z"},
            "id": "C1",
        }
    ]


def test_ingest_pr_converts_url_to_pulse_and_calls_loader(monkeypatch):
    """Test that ingest_pr parses PR URL with trailing slash and triggers PushLoader.process with the correct structure."""
    calls = []

    def mock_process(self, payload, exchange, root_url):
        calls.append((payload, exchange, root_url))

    monkeypatch.setattr(ingest.PushLoader, "process", mock_process)

    pr_url = "https://github.com/mozilla/treeherder/pull/1692/"
    root_url = "https://firefox-ci-tc.services.mozilla.com"

    ingest.ingest_pr(pr_url, root_url)

    assert len(calls) == 1
    payload, exchange, actual_root_url = calls[0]
    assert exchange == "exchange/taskcluster-github/v1/pull-request"
    assert actual_root_url == root_url
    assert payload["organization"] == "mozilla"
    assert payload["repository"] == "treeherder"
    assert payload["action"] == "synchronize"
    assert payload["details"]["event.pullNumber"] == "1692"
    assert payload["details"]["event.base.repo.url"] == "https://github.com/mozilla/treeherder.git"
    assert payload["details"]["event.head.repo.url"] == "https://github.com/mozilla/treeherder.git"


def test_ingest_pr_handles_missing_trailing_slash(monkeypatch):
    """Test that ingest_pr handles a PR URL without a trailing slash correctly."""
    calls = []

    def mock_process(self, payload, exchange, root_url):
        calls.append((payload, exchange, root_url))

    monkeypatch.setattr(ingest.PushLoader, "process", mock_process)

    pr_url = "https://github.com/mozilla/treeherder/pull/1692"
    root_url = "https://firefox-ci-tc.services.mozilla.com"

    ingest.ingest_pr(pr_url, root_url)

    assert len(calls) == 1
    payload, exchange, actual_root_url = calls[0]
    assert exchange == "exchange/taskcluster-github/v1/pull-request"
    assert actual_root_url == root_url
    assert payload["organization"] == "mozilla"
    assert payload["repository"] == "treeherder"
    assert payload["action"] == "synchronize"
    assert payload["details"]["event.pullNumber"] == "1692"
    assert payload["details"]["event.base.repo.url"] == "https://github.com/mozilla/treeherder.git"
    assert payload["details"]["event.head.repo.url"] == "https://github.com/mozilla/treeherder.git"
