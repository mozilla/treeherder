from unittest.mock import MagicMock

from treeherder.etl.management.commands import ingest

REPO_META = {
    "owner": "o",
    "repo": "r",
    "branch": "main",
    "url": "https://github.com/o/r",
    "tc_root_url": "https://tc.example.com",
}


def test_query_data_consumes_compare_dict(monkeypatch):
    """query_data must use PyGithub objects correctly.

    Regression guard for Bug 2038705 refactor.
    """

    mock_repo = MagicMock()

    def create_mock_commit(sha, date, parents=None, message="Fix the issue"):
        mock_commit = MagicMock()
        mock_commit.sha = sha
        mock_commit.commit.committer.name = "Dev"
        mock_commit.commit.committer.email = "dev@example.com"
        mock_commit.commit.committer.date = date
        mock_commit.commit.author.name = "Dev"
        mock_commit.commit.author.email = "dev@example.com"
        mock_commit.commit.author.date = date
        mock_commit.commit.message = message
        mock_commit.parents = parents or []
        return mock_commit

    date1 = "2026-01-01T00:00:00Z"
    date2 = "2026-02-02T00:00:00Z"

    parent_commit = create_mock_commit("PARENT", date2)
    base_commit = create_mock_commit("BASE", date1, parents=[parent_commit])
    c1 = create_mock_commit("C1", date2)

    mock_comparison1 = MagicMock()
    mock_comparison1.merge_base_commit = base_commit
    mock_comparison1.commits = []

    mock_comparison2 = MagicMock()
    mock_comparison2.merge_base_commit = parent_commit
    mock_comparison2.commits = [c1]

    def fake_compare(base, head):
        if base == "main":
            return mock_comparison1
        if base == "PARENT":
            return mock_comparison2
        return MagicMock()

    mock_repo.compare.side_effect = fake_compare
    monkeypatch.setattr(ingest.github, "get_repository", lambda owner, repo_name: mock_repo)

    event_base_sha, commits = ingest.query_data(REPO_META, "HEAD")

    assert event_base_sha == "PARENT"
    assert commits == [
        {
            "message": "Fix the issue",
            "author": {"name": "Dev", "email": "dev@example.com", "date": date2},
            "committer": {"name": "Dev", "email": "dev@example.com", "date": date2},
            "id": "C1",
        }
    ]
