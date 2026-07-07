import unittest
from unittest.mock import Mock, patch

from treeherder.utils import github


class TestGithubUtils(unittest.TestCase):
    @patch("treeherder.utils.github.github_client")
    def test_get_repository(self, mock_github_instance):
        mock_repo = Mock()
        mock_github_instance.get_repo.return_value = mock_repo
        owner = "test_owner"
        repo_name = "test_repo"
        result = github.get_repository(owner, repo_name)
        mock_github_instance.get_repo.assert_called_once_with(
            full_name_or_id=f"{owner}/{repo_name}"
        )
        self.assertEqual(result, mock_repo)

    @patch("treeherder.utils.github.get_repository")
    def test_compare_shas(self, mock_get_repository):
        mock_commit1 = Mock()
        mock_commit2 = Mock()
        mock_comparison = Mock()
        mock_comparison.commits = [mock_commit1, mock_commit2]
        mock_repo = Mock()
        mock_repo.compare.return_value = mock_comparison
        mock_get_repository.return_value = mock_repo

        owner = "test_owner"
        repo_name = "test_repo"
        base = "base_sha"
        head = "head_sha"
        result = github.compare_shas(owner, repo_name, base, head)

        mock_get_repository.assert_called_once_with(owner=owner, repo_name=repo_name)
        mock_repo.compare.assert_called_once_with(base=base, head=head)
        self.assertEqual(result, [mock_commit1, mock_commit2])

    @patch("treeherder.utils.github.get_repository")
    def test_get_comparison(self, mock_get_repository):
        mock_comparison = Mock()
        mock_repo = Mock()
        mock_repo.compare.return_value = mock_comparison
        mock_get_repository.return_value = mock_repo

        owner = "test_owner"
        repo_name = "test_repo"
        base = "base_sha"
        head = "head_sha"
        result = github.get_comparison(owner, repo_name, base, head)

        mock_get_repository.assert_called_once_with(owner=owner, repo_name=repo_name)
        mock_repo.compare.assert_called_once_with(base=base, head=head)
        self.assertEqual(result, mock_comparison)

    @patch("treeherder.utils.github.get_repository")
    def test_get_all_commits(self, mock_get_repository):
        mock_commit1 = Mock()
        mock_commit2 = Mock()
        mock_repo = Mock()
        mock_repo.get_commits.return_value = [mock_commit1, mock_commit2]
        mock_get_repository.return_value = mock_repo

        owner = "test_owner"
        repo_name = "test_repo"
        params = {"sha": "some_sha", "author": "test_author"}
        result = github.get_all_commits(owner, repo_name, params)

        mock_get_repository.assert_called_once_with(owner=owner, repo_name=repo_name)
        mock_repo.get_commits.assert_called_once_with(**params)
        self.assertEqual(result, [mock_commit1, mock_commit2])

    @patch("treeherder.utils.github.get_repository")
    def test_get_commit(self, mock_get_repository):
        mock_commit = Mock()
        mock_repo = Mock()
        mock_repo.get_commit.return_value = mock_commit
        mock_get_repository.return_value = mock_repo

        owner = "test_owner"
        repo_name = "test_repo"
        sha = "test_sha"
        result = github.get_commit(owner, repo_name, sha)

        mock_get_repository.assert_called_once_with(owner=owner, repo_name=repo_name)
        mock_repo.get_commit.assert_called_once_with(sha=sha)
        self.assertEqual(result, mock_commit)

    @patch("treeherder.utils.github.get_repository")
    def test_get_pull_request(self, mock_get_repository):
        mock_pr = Mock()
        mock_repo = Mock()
        mock_repo.get_pull.return_value = mock_pr
        mock_get_repository.return_value = mock_repo

        owner = "test_owner"
        repo_name = "test_repo"
        pr_number = 123
        result = github.get_pull_request(owner, repo_name, pr_number)

        mock_get_repository.assert_called_once_with(owner, repo_name)
        mock_repo.get_pull.assert_called_once_with(pr_number)
        self.assertEqual(result, mock_pr)

    @patch("treeherder.utils.github.get_pull_request")
    def test_get_pull_request_commits(self, mock_get_pull_request):
        mock_commit1 = Mock()
        mock_commit2 = Mock()
        mock_pr = Mock()
        mock_pr.get_commits.return_value = [mock_commit1, mock_commit2]
        mock_get_pull_request.return_value = mock_pr

        owner = "test_owner"
        repo_name = "test_repo"
        pr_number = 123
        result = github.get_pull_request_commits(owner, repo_name, pr_number)

        mock_get_pull_request.assert_called_once_with(owner, repo_name, pr_number)
        mock_pr.get_commits.assert_called_once_with()
        self.assertEqual(result, [mock_commit1, mock_commit2])

    @patch("treeherder.utils.github.get_repository")
    def test_get_releases(self, mock_get_repository):
        mock_release1 = Mock()
        mock_release2 = Mock()
        mock_repo = Mock()
        mock_repo.get_releases.return_value = [mock_release1, mock_release2]
        mock_get_repository.return_value = mock_repo

        owner = "test_owner"
        repo_name = "test_repo"
        result = github.get_releases(owner, repo_name)

        mock_get_repository.assert_called_once_with(owner=owner, repo_name=repo_name)
        mock_repo.get_releases.assert_called_once_with()
        self.assertEqual(result, [mock_release1, mock_release2])
