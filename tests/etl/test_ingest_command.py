from types import SimpleNamespace

from treeherder.etl.management.commands import ingest

REPO_META = {
    "owner": "o",
    "repo": "r",
    "branch": "main",
    "url": "https://github.com/o/r",
    "tc_root_url": "https://tc.example.com",
}


def _commit_obj(
    sha, message=None, author_name=None, author_email=None, committer_date=None, parents=None
):
    return SimpleNamespace(
        sha=sha,
        commit=SimpleNamespace(
            message=message,
            author=SimpleNamespace(name=author_name, email=author_email),
            committer=SimpleNamespace(date=committer_date),
        ),
        parents=[SimpleNamespace(sha=parent_sha) for parent_sha in (parents or [])],
    )


def test_query_data_consumes_comparison_object(monkeypatch):
    """query_data must read a PyGithub Comparison object, not a REST dict.

    Regression guard for Bug 2009865 / Bug 2038705: ``compare_shas`` returns
    PyGithub objects, and query_data must use attribute access so ``ingest push``
    still works for GitHub repos.
    """
    compare_by_range = {
        # base branch vs head: the head isn't on the base branch, so the API
        # reports a merge base whose parent is the real fork point.
        ("main", "HEAD"): SimpleNamespace(
            merge_base_commit=_commit_obj(
                sha="BASE",
                committer_date="2026-01-01T00:00:00Z",
                parents=["PARENT"],
            ),
            commits=[],
        ),
        # re-compare with the corrected base yields the push's commits
        ("PARENT", "HEAD"): SimpleNamespace(
            merge_base_commit=_commit_obj(sha="PARENT", parents=[]),
            commits=[
                _commit_obj(
                    sha="C1",
                    message="Fix the thing",
                    author_name="Dev",
                    author_email="dev@example.com",
                    committer_date="2026-02-02T00:00:00Z",
                )
            ],
        ),
    }

    def fake_compare_shas(owner, repo, base, head, get_comparison_object=False):
        return compare_by_range[(base, head)]

    def fake_get_commit(owner, repo, sha):
        # The merge-base parent, with a committer date different from the merge
        # base so query_data takes the simple (non-recursive) branch.
        return {"sha": sha, "commit": {"committer": {"date": "2026-02-02T00:00:00Z"}}}

    monkeypatch.setattr(ingest, "compare_shas", fake_compare_shas)
    monkeypatch.setattr(ingest, "get_commit", fake_get_commit)

    event_base_sha, commits = ingest.query_data(REPO_META, "HEAD")

    assert event_base_sha == "PARENT"
    assert commits == [
        {
            "message": "Fix the thing",
            "author": {"name": "Dev", "email": "dev@example.com"},
            "committer": {"date": "2026-02-02T00:00:00Z"},
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


def test_ingest_git_pushes_uses_list_commit_metadata(monkeypatch):
    """git-pushes should not issue a get_commit() per SHA; list-commits has parents/dates."""
    monkeypatch.setattr(ingest, "GITHUB_TOKEN", "token")
    monkeypatch.setattr(ingest, "repo_meta", lambda project: REPO_META)

    commits = [
        {
            "sha": "C2",
            "parents": [{"sha": "C1"}],
            "commit": {"committer": {"date": "2026-02-02T00:00:00Z"}},
        },
        {
            "sha": "C1",
            "parents": [{"sha": "ROOT"}],
            "commit": {"committer": {"date": "2026-01-01T00:00:00Z"}},
        },
    ]
    get_commit_calls = []
    monkeypatch.setattr(ingest.github, "get_all_commits", lambda owner, repo: commits)
    monkeypatch.setattr(
        ingest.github, "get_commit", lambda owner, repo, sha: get_commit_calls.append(sha)
    )

    ingested = []
    monkeypatch.setattr(ingest, "ingest_push", lambda project, revision: ingested.append(revision))

    class FakeClient:
        def __init__(self, server_url=None):
            pass

        def get_pushes(self, project, count=None):
            return [{"revision": revision} for revision in ingested]

    monkeypatch.setattr(ingest, "TreeherderClient", FakeClient)

    ingest.ingest_git_pushes("proj", dry_run=False)

    assert get_commit_calls == []
    assert ingested == ["C2", "C1"]
