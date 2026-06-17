from treeherder.etl.management.commands import ingest

REPO_META = {
    "owner": "o",
    "repo": "r",
    "branch": "main",
    "url": "https://github.com/o/r",
    "tc_root_url": "https://tc.example.com",
}


def test_query_data_consumes_compare_dict(monkeypatch):
    """query_data must read the GitHub compare REST response as a dict.

    Regression guard for Bug 2009865, which switched ``compare_shas`` to return
    a list of PyGithub commit objects (for the Pulse push loader) but left
    query_data doing dict access (``.get("merge_base_commit")`` / ``["commits"]``),
    breaking the ``ingest push`` command for GitHub repos.
    """
    compare_by_range = {
        # base branch vs head: the head isn't on the base branch, so the API
        # reports a merge base whose parent is the real fork point.
        "main...HEAD": {
            "merge_base_commit": {
                "sha": "BASE",
                "commit": {"committer": {"date": "2026-01-01T00:00:00Z"}},
                "parents": [
                    {
                        "sha": "PARENT",
                        "url": "https://api.github.com/repos/o/r/commits/PARENT",
                    }
                ],
            },
            "commits": [],
        },
        # re-compare with the corrected base yields the push's commits
        "PARENT...HEAD": {
            "merge_base_commit": {"sha": "PARENT", "parents": []},
            "commits": [
                {
                    "sha": "C1",
                    "commit": {
                        "message": "Fix the thing",
                        "author": {"name": "Dev", "email": "dev@example.com"},
                        "committer": {"date": "2026-02-02T00:00:00Z"},
                    },
                }
            ],
        },
    }

    def fake_fetch_api(path, params=None):
        return compare_by_range[path.split("/compare/")[1]]

    def fake_fetch_api_full_url(url, params=None):
        # The merge-base parent, with a committer date different from the merge
        # base so query_data takes the simple (non-recursive) branch.
        return {"sha": "PARENT", "commit": {"committer": {"date": "2026-02-02T00:00:00Z"}}}

    monkeypatch.setattr(ingest, "fetch_api", fake_fetch_api)
    monkeypatch.setattr(ingest, "fetch_api_full_url", fake_fetch_api_full_url)

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
