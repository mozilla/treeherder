import logging

import newrelic.agent
from django.core.cache import cache

from treeherder.etl.common import to_timestamp
from treeherder.etl.push import store_push
from treeherder.etl.revision_mapper import parse_github_url
from treeherder.model.models import Repository
from treeherder.utils.github import get_all_commits, get_commit

logger = logging.getLogger(__name__)
ONE_WEEK_IN_SECONDS = 604800


class GitPushFetchError(Exception):
    """Raised when fetching or parsing a git push fails."""


def _transform_github_commit(commit_data):
    """Transform a GitHub commit API response into the standard push dict format.

    Returns:
        {
            "revision": "<40-char sha>",
            "author": "email@example.com",
            "push_timestamp": <unix_timestamp>,
            "revisions": [{"revision": "...", "author": "...", "comment": "..."}, ...]
        }
    """
    commit_info = commit_data["commit"]
    author_name = commit_info["author"]["name"]
    author_email = commit_info["author"]["email"]
    return {
        "revision": commit_data["sha"],
        "author": author_email,
        "push_timestamp": to_timestamp(commit_info["committer"]["date"]),
        "revisions": [
            {
                "revision": commit_data["sha"],
                "author": f"{author_name} <{author_email}>",
                "comment": commit_info["message"],
            }
        ],
    }


def fetch_git_push(git_url, revision):
    """Fetch a single commit's data from GitHub and return as a standard push dict.

    Args:
        git_url: GitHub repository URL (e.g., "https://github.com/owner/repo")
        revision: The git commit SHA to fetch

    Returns:
        Standard push dict suitable for store_push()

    Raises:
        GitPushFetchError: If the fetch fails
    """
    owner, repo = parse_github_url(git_url)
    try:
        data = get_commit(owner, repo, revision)
    except Exception as e:
        raise GitPushFetchError(
            f"Failed to fetch git commit {revision} from {owner}/{repo}: {e}"
        ) from e

    return _transform_github_commit(data)


class GitPushlogProcess:
    """Mirrors HgPushlogProcess but fetches from the GitHub commits API.

    Used for scheduled polling of git-based repositories.
    """

    def extract(self, owner, repo, branch, since=None):
        """Fetch commits from GitHub commits API."""
        params = {"sha": branch, "per_page": 100}
        if since:
            params["since"] = since
        try:
            return get_all_commits(owner, repo, params)
        except Exception as e:
            logger.warning(
                "Failed to fetch git commits from %s/%s branch %s: %s",
                owner,
                repo,
                branch,
                e,
            )
            raise

    def transform_commit(self, commit_data):
        """Transform a GitHub commit into the standard push dict format."""
        return _transform_github_commit(commit_data)

    def run(self, git_url, branch, repository_name, since_timestamp=None):
        """Fetch and store new pushes from Git.

        Similar caching pattern to HgPushlogProcess: caches the timestamp
        of the last processed commit to enable incremental fetching.
        """
        cache_key = f"{repository_name}:last_git_commit_time"
        if not since_timestamp:
            since_timestamp = cache.get(cache_key)

        owner, repo = parse_github_url(git_url)
        newrelic.agent.add_custom_attribute("repo_name", repository_name)
        newrelic.agent.add_custom_attribute("git_url", git_url)

        commits = self.extract(owner, repo, branch, since=since_timestamp)

        if not commits:
            return None

        repository = Repository.objects.get(name=repository_name)
        errors = []
        latest_timestamp = since_timestamp

        # GitHub returns commits newest-first; process in chronological order
        for commit_data in reversed(commits):
            try:
                push_data = self.transform_commit(commit_data)
                store_push(repository, push_data)

                commit_time = commit_data["commit"]["committer"]["date"]
                if not latest_timestamp or commit_time > latest_timestamp:
                    latest_timestamp = commit_time
            except Exception:
                logger.exception(
                    "Error storing git push for %s: %s",
                    repository_name,
                    commit_data.get("sha", "unknown"),
                )
                newrelic.agent.notice_error()
                errors.append(commit_data.get("sha", "unknown"))

        if latest_timestamp:
            cache.set(cache_key, latest_timestamp, ONE_WEEK_IN_SECONDS)

        top_revision = commits[0]["sha"] if commits else None

        if errors:
            logger.warning(
                "Errors processing %d git commits for %s",
                len(errors),
                repository_name,
            )

        return top_revision
