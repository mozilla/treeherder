from datetime import UTC, datetime
from unittest.mock import patch

import pytest

from treeherder.utils.github import (
    compare_shas,
    get_all_commits,
    get_comparison,
    get_releases,
)


# Mock GitCommit and it's related classes
class MockCommitParent:
    def __init__(self, sha):
        self.sha = sha


class MockCommitFile:
    def __init__(self, filename):
        self.filename = filename


class MockCommitter:
    def __init__(self, date, name="author"):
        self.date = date
        self.name = name


class MockGitAuthor:
    def __init__(self, date, name="author"):
        self.date = date
        self.name = name


class MockInnerCommit:
    def __init__(self, committer_date, author_name="author", message=""):
        self.committer = MockCommitter(committer_date)
        self.author = MockGitAuthor(committer_date, author_name)
        self.message = message


class MockCommit:
    def __init__(self, sha, committer_date, parents=None, files=None, html_url=None, message=""):
        self.sha = sha
        self.html_url = html_url or f"https://github.com/mock-owner/mock-repo/commit/{sha}"
        self.commit = MockInnerCommit(committer_date, message=message)
        self.parents = [MockCommitParent(p_sha) for p_sha in parents] if parents else []
        self.files = [MockCommitFile(f_name) for f_name in files] if files else []


@pytest.fixture
def github_commit_mock():
    """
    A factory fixture that patches the github object, sets up a MockRepository,
    and returns a helper function to easily register commits.
    """
    with patch("treeherder.utils.github.github") as mock_github:
        mock_repo = MockRepository()
        mock_github.get_repo.return_value = mock_repo

        def _register(sha, committer_date, parents=None, files=None, message=""):
            commit_obj = MockCommit(
                sha=sha,
                committer_date=committer_date,
                parents=parents,
                files=files,
                message=message,
            )
            mock_repo._commits[sha] = commit_obj
            return mock_github, mock_repo, commit_obj

        yield _register


# Helper for MockGitRelease
class MockAuthor:
    def __init__(self, login):
        self.login = login

    def __repr__(self):
        return f"<MockAuthor login='{self.login}'>"


# Mock GitRelease class to simulate PyGithub's GitRelease objects
class MockGitRelease:
    def __init__(
        self,
        published_at_str,
        title="",
        id=None,
        tag_name=None,
        html_url=None,
        author_login="test-author",
    ):
        # Store published_at as a datetime object, ensuring it's timezone-aware
        dt_obj = datetime.fromisoformat(published_at_str)
        self.published_at = dt_obj.replace(tzinfo=UTC) if dt_obj.tzinfo is None else dt_obj

        self.title = title
        # Simulate other attributes expected by get_releases
        # Using hash for default ID to provide some uniqueness if not explicitly set
        self.id = id if id is not None else hash(published_at_str + title) % (10**7)
        self.name = title if title else f"Release {self.id}"
        self.tag_name = tag_name if tag_name is not None else f"v{self.id}"
        self.html_url = (
            html_url
            if html_url is not None
            else f"https://github.com/mock-owner/mock-repo/releases/tag/{self.tag_name}"
        )
        self.author = MockAuthor(author_login) if author_login else None

    # This method creates the dictionary structure that get_releases in github.py is expected to return
    def to_expected_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "tag_name": self.tag_name,
            "published_at": self.published_at,
            "html_url": self.html_url,
            "author": {"login": self.author.login if self.author else "unknown"},
        }

    # Add __repr__ for better debugging output in case of test failures
    def __repr__(self):
        return (
            f"<MockGitRelease id={self.id}, name='{self.name}', tag_name='{self.tag_name}', "
            f"published_at='{self.published_at.isoformat()}', author={self.author}>"
        )


# Mock Repository class to simulate PyGithub's Repository objects
class MockRepository:
    def __init__(self, releases=None, commits=None):
        self._releases = releases or []
        self._commits = commits or {}

    def get_releases(self):
        # PyGithub's get_releases returns an iterable (PaginatedList),
        # with releases in reverse chronological order.
        # Returning a list directly simulates this behavior for the mock.
        return self._releases

    def get_commit(self, sha):
        return self._commits[sha]

    def get_commits(self, since=None):
        return list(self._commits.values())

    def compare(self, base, head):
        class MockComparison:
            def __init__(self, commits):
                self.commits = commits
                self.merge_base_commit = None

        return MockComparison(list(self._commits.values()))


@patch("treeherder.utils.github.github")
def test_get_releases_no_params(mock_github):
    """
    Test get_releases reruns all releases when no filtering parameters are provided.
    """
    owner = "test-owner"
    repo = "test-repo"

    # Define mock release objects in chronological order
    mock_release_1_input = MockGitRelease("2023-01-01T10:00:00+00:00", "Release 1", id=101)
    mock_release_2_input = MockGitRelease("2023-01-05T12:00:00+00:00", "Release 2", id=102)
    mock_release_3_input = MockGitRelease("2023-01-10T14:00:00+00:00", "Release 3", id=103)
    all_mock_releases_chrono = [mock_release_1_input, mock_release_2_input, mock_release_3_input]

    # For MockRepository, simulate PyGithub's reverse chronological order
    all_mock_releases_input_for_repo = list(reversed(all_mock_releases_chrono))

    # Configure the mock github object to return our mock repository
    mock_repo_instance = MockRepository(all_mock_releases_input_for_repo)
    mock_github.get_repo.return_value = mock_repo_instance

    # Call the function under test without any params
    result = list(get_releases(owner, repo))

    # Construct the expected output list of dictionaries (should be in the order they were processed)
    expected_result = [r.to_expected_dict() for r in all_mock_releases_input_for_repo]

    # Assertions
    mock_github.get_repo.assert_called_once_with(f"{owner}/{repo}")
    assert len(result) == 3
    assert result == expected_result


@patch("treeherder.utils.github.github")
def test_get_releases_with_number_param(mock_github):
    """
    Test get_releases returns the oldest N items per repository when filtered by the 'number' parameter.
    """
    owner = "test-owner"
    repo = "test-repo"

    # Define mock release objects in chronological order
    mock_release_1_input = MockGitRelease("2023-01-01T10:00:00+00:00", "Release 1", id=101)
    mock_release_2_input = MockGitRelease("2023-01-05T12:00:00+00:00", "Release 2", id=102)
    mock_release_3_input = MockGitRelease("2023-01-10T14:00:00+00:00", "Release 3", id=103)
    all_mock_releases_chrono = [mock_release_1_input, mock_release_2_input, mock_release_3_input]

    # For MockRepository, simulate PyGithub's reverse chronological order
    all_mock_releases_input_for_repo = list(reversed(all_mock_releases_chrono))  # [R3, R2, R1]

    mock_repo_instance = MockRepository(all_mock_releases_input_for_repo)
    mock_github.get_repo.return_value = mock_repo_instance

    # Test with number = 2
    # get_releases processes [R3, R2, R1]
    # It adds R3, then R2. max_number is 2, so it breaks after R2.
    # Result should be [R3_dict, R2_dict]
    params = {"number": 2}
    result = list(get_releases(owner, repo, params))

    expected_result_2 = [r.to_expected_dict() for r in all_mock_releases_input_for_repo[:2]]
    assert len(result) == 2
    assert result == expected_result_2

    # Test with number larger than available releases
    # get_releases processes [R3, R2, R1]
    # All are added, as number limit is 10.
    # Result should be [R3_dict, R2_dict, R1_dict]
    params_large_number = {"number": 10}
    result_large_number = list(get_releases(owner, repo, params_large_number))
    expected_result_large = [r.to_expected_dict() for r in all_mock_releases_input_for_repo]
    assert len(result_large_number) == 3
    assert result_large_number == expected_result_large


@patch("treeherder.utils.github.github")
def test_get_releases_with_since_param(mock_github):
    """
    Test get_releases returns relases published after the 'since' parameter when provided with a 'since' parameter.
    """
    owner = "test-owner"
    repo = "test-repo"

    # Define mock release objects in chronological order
    mock_release_1_input = MockGitRelease("2023-01-01T10:00:00+00:00", "Release 1", id=101)
    mock_release_2_input = MockGitRelease("2023-01-05T12:00:00+00:00", "Release 2", id=102)
    mock_release_3_input = MockGitRelease("2023-01-10T14:00:00+00:00", "Release 3", id=103)
    all_mock_releases_chrono = [mock_release_1_input, mock_release_2_input, mock_release_3_input]

    # For MockRepository, simulate PyGithub's reverse chronological order
    all_mock_releases_input_for_repo = list(reversed(all_mock_releases_chrono))  # [R3, R2, R1]

    mock_repo_instance = MockRepository(all_mock_releases_input_for_repo)
    mock_github.get_repo.return_value = mock_repo_instance

    # Test with a 'since' date that includes Release 2 and 3
    # github.py processes [R3, R2, R1]
    # since_dt = 2023-01-05T12:00:00+00:00 (R2's timestamp)
    # R3 (2023-01-10) >= since_dt (add R3)
    # R2 (2023-01-05) >= since_dt (add R2)
    # R1 (2023-01-01) < since_dt (break)
    # Result: [R3_dict, R2_dict]
    since_date_str = "2023-01-05T12:00:00+00:00"
    params = {"since": since_date_str}
    result = list(get_releases(owner, repo, params))

    expected_result = [
        mock_release_3_input.to_expected_dict(),
        mock_release_2_input.to_expected_dict(),
    ]
    assert len(result) == 2
    assert result == expected_result

    # Test with a 'since' date that excludes everything
    # since_dt = 2023-01-15T00:00:00+00:00
    # R3 (2023-01-10) < since_dt (break)
    # Result: []
    since_date_str_later = "2023-01-15T00:00:00+00:00"
    params_later = {"since": since_date_str_later}
    result_later = list(get_releases(owner, repo, params_later))
    assert len(result_later) == 0
    assert result_later == []

    # Test with a 'since' date that includes everything
    # since_dt = 2022-12-31T00:00:00+00:00
    # R3 >= since_dt (add R3)
    # R2 >= since_dt (add R2)
    # R1 >= since_dt (add R1)
    # Result: [R3_dict, R2_dict, R1_dict]
    since_date_str_earlier = "2022-12-31T00:00:00+00:00"
    params_earlier = {"since": since_date_str_earlier}
    result_earlier = list(get_releases(owner, repo, params_earlier))
    expected_result_earlier = [r.to_expected_dict() for r in all_mock_releases_input_for_repo]
    assert len(result_earlier) == 3
    assert result_earlier == expected_result_earlier


@patch("treeherder.utils.github.github")
def test_get_releases_with_number_and_since_params(mock_github):
    """
    Test get_releases orders releases correctly when filtered by both 'number' and 'since' parameters.
    """
    owner = "test-owner"
    repo = "test-repo"

    # Define mock release objects in chronological order
    _mock_release_1_input = MockGitRelease("2023-01-01T10:00:00+00:00", "Release 1", id=101)
    _mock_release_2_input = MockGitRelease("2023-01-05T12:00:00+00:00", "Release 2", id=102)
    _mock_release_3_input = MockGitRelease("2023-01-10T14:00:00+00:00", "Release 3", id=103)
    _mock_release_4_input = MockGitRelease("2023-01-15T16:00:00+00:00", "Release 4", id=104)
    _mock_release_5_input = MockGitRelease("2023-01-20T18:00:00+00:00", "Release 5", id=105)

    all_mock_releases_chrono = [
        _mock_release_1_input,
        _mock_release_2_input,
        _mock_release_3_input,
        _mock_release_4_input,
        _mock_release_5_input,
    ]

    # For MockRepository, simulate PyGithub's reverse chronological order
    all_mock_releases_input_for_repo = list(
        reversed(all_mock_releases_chrono)
    )  # [R5, R4, R3, R2, R1]

    mock_repo_instance = MockRepository(all_mock_releases_input_for_repo)
    mock_github.get_repo.return_value = mock_repo_instance

    # Scenario 1: number=3, since='2023-01-05T12:00:00+00:00'
    # 'since' datetime is 2023-01-05T12:00:00+00:00 (R2's timestamp)
    # Loop over [R5, R4, R3, R2, R1]:
    #   R5 (2023-01-20) >= since_dt (add R5) -> releases=[R5]
    #   R4 (2023-01-15) >= since_dt (add R4) -> releases=[R5, R4]
    #   R3 (2023-01-10) >= since_dt (add R3) -> releases=[R5, R4, R3]
    #   R2 (2023-01-05) >= since_dt (add R2) -> releases=[R5, R4, R3, R2]
    #   R1 (2023-01-01) < since_dt (break)
    # Filtered by since: [R5, R4, R3, R2]
    # Then apply 'number': take first 3 from this list.
    # Expected: [R5_dict, R4_dict, R3_dict]
    params_s1 = {"since": "2023-01-05T12:00:00+00:00", "number": 3}
    result_s1 = list(get_releases(owner, repo, params_s1))
    expected_s1 = [
        _mock_release_5_input.to_expected_dict(),
        _mock_release_4_input.to_expected_dict(),
        _mock_release_3_input.to_expected_dict(),
    ]
    assert len(result_s1) == 3
    assert result_s1 == expected_s1

    # Scenario 2: number=1, since='2023-01-20T18:00:01+00:00'
    # 'since' datetime is 2023-01-20T18:00:01+00:00 (strictly after R5)
    # Loop over [R5, R4, R3, R2, R1]:
    #   R5 (2023-01-20) < since_dt (break immediately)
    # Filtered by since: []
    # Then apply 'number' (1):
    # Expected: []
    params_s2 = {"since": "2023-01-20T18:00:01+00:00", "number": 1}
    result_s2 = list(get_releases(owner, repo, params_s2))
    assert len(result_s2) == 0
    assert result_s2 == []

    # Scenario 3: number=100 (effectively no number limit), since='2023-01-10T14:00:00+00:00'
    # 'since' datetime is 2023-01-10T14:00:00+00:00 (R3's timestamp)
    # Loop over [R5, R4, R3, R2, R1]:
    #   R5 (2023-01-20) >= since_dt (add R5)
    #   R4 (2023-01-15) >= since_dt (add R4)
    #   R3 (2023-01-10) >= since_dt (add R3)
    #   R2 (2023-01-05) < since_dt (break)
    # Filtered by since: [R5, R4, R3]
    # Then apply 'number' (100):
    # Expected: [R5_dict, R4_dict, R3_dict]
    params_s3 = {"since": "2023-01-10T14:00:00+00:00", "number": 100}
    result_s3 = list(get_releases(owner, repo, params_s3))
    expected_s3 = [
        _mock_release_5_input.to_expected_dict(),
        _mock_release_4_input.to_expected_dict(),
        _mock_release_3_input.to_expected_dict(),
    ]
    assert len(result_s3) == 3
    assert result_s3 == expected_s3


def test_get_commit_standard(github_commit_mock):
    """
    Test get_commit returns a dictionary representing a standard commit with files, parents, and committer date.
    """
    owner = "test-owner"
    repo = "test-repo"
    sha = "abc123commitsha"
    date_str = "2023-01-01T12:00:00Z"

    mock_github, _, _ = github_commit_mock(
        sha=sha,
        committer_date=date_str,
        parents=["parentsha1", "parentsha2"],
        files=["file1.py", "file2.py"],
    )

    from treeherder.utils.github import get_commit

    result = get_commit(owner, repo, sha)

    # Assertions
    mock_github.get_repo.assert_called_once_with(f"{owner}/{repo}")
    assert result == {
        "files": [{"filename": "file1.py"}, {"filename": "file2.py"}],
        "commit": {"committer": {"date": date_str}},
        "parents": [{"sha": "parentsha1"}, {"sha": "parentsha2"}],
    }


def test_get_commit_initial_commit(github_commit_mock):
    """
    Test get_commit handles an initial/root commit with no parents.
    """
    owner = "test-owner"
    repo = "test-repo"
    sha = "initialcommitsha"
    date_str = "2023-01-01T00:00:00Z"

    github_commit_mock(
        sha=sha,
        committer_date=date_str,
        parents=[],
        files=["README.md"],
    )

    from treeherder.utils.github import get_commit

    result = get_commit(owner, repo, sha)

    assert result == {
        "files": [{"filename": "README.md"}],
        "commit": {"committer": {"date": date_str}},
        "parents": [],
    }


def test_get_commit_no_files(github_commit_mock):
    """
    Test get_commit handles a commit with no files changed.
    """
    owner = "test-owner"
    repo = "test-repo"
    sha = "nofilescommitsha"
    date_str = "2023-01-02T10:00:00Z"

    github_commit_mock(
        sha=sha,
        committer_date=date_str,
        parents=["parentsha"],
        files=[],
    )

    from treeherder.utils.github import get_commit

    result = get_commit(owner, repo, sha)

    assert result == {
        "files": [],
        "commit": {"committer": {"date": date_str}},
        "parents": [{"sha": "parentsha"}],
    }


def _register_list_commits(mock_github, commits):
    mock_repo = MockRepository()
    mock_github.get_repo.return_value = mock_repo
    for commit in commits:
        mock_repo._commits[commit.sha] = commit
    return mock_repo


@patch("treeherder.utils.github.github")
def test_get_all_commits_no_params(mock_github):
    """get_all_commits returns dicts matching the GitHub list-commits shape."""
    owner = "test-owner"
    repo = "test-repo"
    c1 = MockCommit("sha1", datetime(2023, 1, 10, tzinfo=UTC), message="second")
    c2 = MockCommit("sha2", datetime(2023, 1, 5, tzinfo=UTC), message="first")
    _register_list_commits(mock_github, [c1, c2])

    result = list(get_all_commits(owner, repo))

    mock_github.get_repo.assert_called_once_with(f"{owner}/{repo}")
    assert [c["sha"] for c in result] == ["sha1", "sha2"]
    assert result[0]["html_url"] == c1.html_url
    assert result[0]["commit"]["message"] == "second"
    assert result[0]["commit"]["author"]["name"] == "author"
    assert result[0]["commit"]["author"]["date"] == c1.commit.author.date
    assert result[0]["commit"]["committer"]["date"] == c1.commit.committer.date


@patch("treeherder.utils.github.github")
def test_get_all_commits_with_number_param(mock_github):
    """Collector gh_options `number` limits how many commits are yielded."""
    owner = "test-owner"
    repo = "test-repo"
    commits = [
        MockCommit(f"sha{i}", datetime(2023, 1, 10 - i, tzinfo=UTC), message=f"c{i}")
        for i in range(5)
    ]
    mock_repo = _register_list_commits(mock_github, commits)
    mock_repo.get_commits = lambda **kwargs: commits

    result = list(get_all_commits(owner, repo, params={"number": 2}))

    assert [c["sha"] for c in result] == ["sha0", "sha1"]


@patch("treeherder.utils.github.github")
def test_get_all_commits_with_since_param(mock_github):
    """Collector gh_options `since` is passed to PyGithub as a datetime."""
    owner = "test-owner"
    repo = "test-repo"
    since_commit = MockCommit("new", datetime(2023, 1, 10, tzinfo=UTC), message="new")
    mock_repo = MockRepository()
    mock_github.get_repo.return_value = mock_repo

    captured = {}

    def capture_get_commits(**kwargs):
        captured.update(kwargs)
        return [since_commit]

    mock_repo.get_commits = capture_get_commits
    since_str = "2023-01-05T12:00:00+00:00"
    result = list(get_all_commits(owner, repo, params={"since": since_str}))

    assert captured["since"] == datetime.fromisoformat(since_str)
    assert [c["sha"] for c in result] == ["new"]


@patch("treeherder.utils.github.github")
def test_get_all_commits_with_number_and_since_params(mock_github):
    """Both collector gh_options are applied together."""
    owner = "test-owner"
    repo = "test-repo"
    newer = MockCommit("newer", datetime(2023, 1, 20, tzinfo=UTC), message="newer")
    older = MockCommit("older", datetime(2023, 1, 10, tzinfo=UTC), message="older")
    mock_repo = MockRepository()
    mock_github.get_repo.return_value = mock_repo

    captured = {}

    def capture_get_commits(**kwargs):
        captured.update(kwargs)
        return [newer, older]

    mock_repo.get_commits = capture_get_commits
    result = list(
        get_all_commits(
            owner,
            repo,
            params={"since": "2023-01-05T00:00:00+00:00", "number": 1},
        )
    )

    assert captured["since"] == datetime(2023, 1, 5, tzinfo=UTC)
    assert [c["sha"] for c in result] == ["newer"]


@patch("treeherder.utils.github.github")
def test_get_comparison_and_compare_shas(mock_github):
    """get_comparison returns the PyGithub Comparison; compare_shas stays a commit list."""
    owner = "test-owner"
    repo = "test-repo"
    c1 = MockCommit("sha1", datetime(2023, 1, 10, tzinfo=UTC), message="one")
    c2 = MockCommit("sha2", datetime(2023, 1, 5, tzinfo=UTC), message="two")
    mock_repo = MockRepository()
    mock_repo._commits = {"sha1": c1, "sha2": c2}
    mock_github.get_repo.return_value = mock_repo

    comparison = get_comparison(owner, repo, "base", "head")
    mock_github.get_repo.assert_called_with(f"{owner}/{repo}")
    assert list(comparison.commits) == [c1, c2]

    result = compare_shas(owner, repo, "base", "head")
    assert result == [c1, c2]
