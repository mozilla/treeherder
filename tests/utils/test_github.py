from datetime import datetime
from unittest.mock import patch

# Import the function to be tested
from treeherder.utils.github import get_releases


# Mock GitRelease class to simulate PyGithub's GitRelease objects
class MockGitRelease:
    def __init__(self, published_at_str, title=""):
        # Store published_at as a datetime object
        self.published_at = datetime.fromisoformat(published_at_str)
        self.title = title

    # Add __repr__ for better debugging output in case of test failures
    def __repr__(self):
        return (
            f"<MockGitRelease title='{self.title}' published_at='{self.published_at.isoformat()}'>"
        )

    # Add __eq__ for proper comparison in assertions
    def __eq__(self, other):
        if not isinstance(other, MockGitRelease):
            return NotImplemented
        return self.published_at == other.published_at and self.title == other.title


# Mock Repository class to simulate PyGithub's Repository objects
class MockRepository:
    def __init__(self, releases):
        self._releases = releases

    def get_releases(self):
        # PyGithub's get_releases returns an iterable (PaginatedList).
        # Returning a list directly simplifies the mock while maintaining iterable behavior.
        return self._releases


@patch("treeherder.utils.github.github")
def test_get_releases_no_params(mock_github):
    """
    Test get_releases reruns all releases when no filtering parameters are provided.
    """
    owner = "test-owner"
    repo = "test-repo"

    # Define mock release objects
    mock_release_1 = MockGitRelease("2023-01-01T10:00:00", "Release 1")
    mock_release_2 = MockGitRelease("2023-01-05T12:00:00", "Release 2")
    mock_release_3 = MockGitRelease("2023-01-10T14:00:00", "Release 3")
    all_mock_releases = [mock_release_1, mock_release_2, mock_release_3]

    # Configure the mock github object to return our mock repository
    mock_repo_instance = MockRepository(all_mock_releases)
    mock_github.get_repo.return_value = mock_repo_instance

    # Call the function under test without any params
    result = get_releases(owner, repo)

    # Assertions
    # Ensure get_repo was called correctly
    mock_github.get_repo.assert_called_once_with(f"{owner}/{repo}")
    # Ensure all releases are returned
    assert len(result) == 3
    assert result == all_mock_releases


@patch("treeherder.utils.github.github")
def test_get_releases_with_number_param(mock_github):
    """
    Test get_releases returns the oldest N items per repository when filtered by the 'number' parameter.
    """
    owner = "test-owner"
    repo = "test-repo"

    mock_release_1 = MockGitRelease("2023-01-01T10:00:00", "Release 1")
    mock_release_2 = MockGitRelease("2023-01-05T12:00:00", "Release 2")
    mock_release_3 = MockGitRelease("2023-01-10T14:00:00", "Release 3")
    all_mock_releases = [mock_release_1, mock_release_2, mock_release_3]

    mock_repo_instance = MockRepository(all_mock_releases)
    mock_github.get_repo.return_value = mock_repo_instance

    # Test with number = 2
    params = {"number": 2}
    result = get_releases(owner, repo, params)

    assert len(result) == 2
    assert result == [mock_release_1, mock_release_2]

    # Test with number larger than available releases
    params_large_number = {"number": 10}
    result_large_number = get_releases(owner, repo, params_large_number)
    assert len(result_large_number) == 3
    assert result_large_number == all_mock_releases


@patch("treeherder.utils.github.github")
def test_get_releases_with_since_param(mock_github):
    """
    Test get_releases returns relases published after the 'since' parameter when provided with a 'since' parameter.
    """
    owner = "test-owner"
    repo = "test-repo"

    mock_release_1 = MockGitRelease("2023-01-01T10:00:00", "Release 1")
    mock_release_2 = MockGitRelease("2023-01-05T12:00:00", "Release 2")
    mock_release_3 = MockGitRelease("2023-01-10T14:00:00", "Release 3")
    all_mock_releases = [mock_release_1, mock_release_2, mock_release_3]

    mock_repo_instance = MockRepository(all_mock_releases)
    mock_github.get_repo.return_value = mock_repo_instance

    # Test with a 'since' date that includes Release 2 and 3
    since_date_str = "2023-01-05T12:00:00"
    params = {"since": since_date_str}
    result = get_releases(owner, repo, params)

    assert len(result) == 2
    assert result == [mock_release_2, mock_release_3]

    # Test with a 'since' date that excludes everything
    since_date_str_later = "2023-01-15T00:00:00"
    params_later = {"since": since_date_str_later}
    result_later = get_releases(owner, repo, params_later)
    assert len(result_later) == 0

    # Test with a 'since' date that includes everything
    since_date_str_earlier = "2022-12-31T00:00:00"
    params_earlier = {"since": since_date_str_earlier}
    result_earlier = get_releases(owner, repo, params_earlier)
    assert len(result_earlier) == 3
    assert result_earlier == all_mock_releases


@patch("treeherder.utils.github.github")
def test_get_releases_with_number_and_since_params(mock_github):
    """
    Test get_releases orders releases correctly when filtered by both 'number' and 'since' parameters.
    """
    owner = "test-owner"
    repo = "test-repo"

    mock_release_1 = MockGitRelease("2023-01-01T10:00:00", "Release 1")
    mock_release_2 = MockGitRelease("2023-01-05T12:00:00", "Release 2")
    mock_release_3 = MockGitRelease("2023-01-10T14:00:00", "Release 3")
    mock_release_4 = MockGitRelease("2023-01-15T16:00:00", "Release 4")
    mock_release_5 = MockGitRelease("2023-01-20T18:00:00", "Release 5")
    all_mock_releases = [
        mock_release_1,
        mock_release_2,
        mock_release_3,
        mock_release_4,
        mock_release_5,
    ]

    mock_repo_instance = MockRepository(all_mock_releases)
    mock_github.get_repo.return_value = mock_repo_instance

    # Scenario 1: number=2, since='2023-01-05T12:00:00'
    # 1. Apply number filter first: [R1, R2, R3, R4, R5] -> [:2] -> [R1, R2]
    # 2. Apply since filter to [R1, R2]:
    #    R1 (Jan 1) is NOT >= Jan 5
    #    R2 (Jan 5) IS >= Jan 5
    # Expected: [R2]
    params_s1 = {"since": "2023-01-05T12:00:00", "number": 2}
    result_s1 = get_releases(owner, repo, params_s1)
    assert len(result_s1) == 1
    assert result_s1 == [mock_release_2]

    # Scenario 2: number=1, since='2023-01-10T14:00:00'
    # 1. Apply number filter first: [R1, R2, R3, R4, R5] -> [:1] -> [R1]
    # 2. Apply since filter to [R1]:
    #    R1 (Jan 1) is NOT >= Jan 10
    # Expected: []
    params_s2 = {"since": "2023-01-10T14:00:00", "number": 1}
    result_s2 = get_releases(owner, repo, params_s2)
    assert len(result_s2) == 0
    assert result_s2 == []

    # Scenario 3: number=100 (effectively no number limit), since='2023-01-10T14:00:00'
    # 1. Apply number filter first: [R1, R2, R3, R4, R5] -> [:100] -> [R1, R2, R3, R4, R5]
    # 2. Apply since filter to [R1, R2, R3, R4, R5]:
    #    R1, R2 are NOT >= Jan 10
    #    R3, R4, R5 ARE >= Jan 10
    # Expected: [R3, R4, R5]
    params_s3 = {"since": "2023-01-10T14:00:00", "number": 100}
    result_s3 = get_releases(owner, repo, params_s3)
    assert len(result_s3) == 3
    assert result_s3 == [mock_release_3, mock_release_4, mock_release_5]
