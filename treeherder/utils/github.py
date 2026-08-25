from datetime import UTC, datetime

from github import Auth, Github
from github.GitRelease import GitRelease

from treeherder.config.settings import GITHUB_TOKEN
from treeherder.utils.http import fetch_json

if GITHUB_TOKEN:
    auth = Auth.Token(GITHUB_TOKEN)
    github = Github(auth=auth)
else:
    github = Github()


def fetch_api(path, params=None):
    return fetch_api_full_url(f"https://api.github.com/{path}", params)


def fetch_api_full_url(url, params=None):
    if GITHUB_TOKEN:
        headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    else:
        headers = {}
    return fetch_json(url, params, headers)


def get_repo(owner, repo, params=None):
    return pygithub_get_repo(owner, repo)


def pygithub_get_repo(owner, repo):
    return github.get_repo(f"{owner}/{repo}")


def _parse_list_options(params):
    """Parse collector-style gh_options (`number`, `since`) for list endpoints."""
    max_number = None
    since_dt = None
    if not params:
        return max_number, since_dt

    max_number = params.get("number")
    since_dt = params.get("since")
    if since_dt is not None and not isinstance(since_dt, datetime):
        since_dt = datetime.fromisoformat(since_dt)
    if isinstance(since_dt, datetime) and since_dt.tzinfo is None:
        since_dt = since_dt.replace(tzinfo=UTC)
    return max_number, since_dt


def get_releases(owner, repo, params=None):
    """
    Retrieve GitHub releases for a given repository.
    Returns a list of standardized dictionaries representing releases.
    """
    paginated_releases = pygithub_get_repo(owner=owner, repo=repo).get_releases()

    releases: list[GitRelease] = []
    max_number, since_dt = _parse_list_options(params)

    for release in paginated_releases:
        # Break if we have reached max_number
        if max_number and len(releases) >= max_number:
            break

        # PyGithub returns releases in reverse chronological order
        # Stop immediately if releases older than the since_dt are found
        release_dt = release.published_at
        if since_dt and release_dt:
            if release_dt.tzinfo is None:
                release_dt.replace(tzinfo=UTC)
            if release.published_at < since_dt:
                break
        release_dict = {
            "id": release.id,
            "name": release.name,
            "tag_name": release.tag_name,
            "published_at": release.published_at,
            "html_url": release.html_url,
            "author": {"login": release.author.login if release.author else "unknown"},
        }
        releases.append(release_dict)

    return releases


def compare_shas(owner, repo, base, head):
    repo = pygithub_get_repo(owner, repo)
    comparison = repo.compare(base, head)
    return [commit for commit in comparison.commits]


def get_all_commits(owner, repo, params=None):
    """
    Retrieve GitHub commits for a given repository.

    ``params`` accepts the same collector gh_options as ``get_releases``:
    ``number`` (max commits to return) and ``since`` (ISO-8601 string or datetime).

    Yields standardized dictionaries matching the GitHub list-commits JSON shape
    used by collector.py and ingest.py.
    """
    max_number, since_dt = _parse_list_options(params)
    repo_object = pygithub_get_repo(owner, repo)
    kwargs = {}
    if since_dt is not None:
        kwargs["since"] = since_dt

    count = 0
    for commit in repo_object.get_commits(**kwargs):
        if max_number and count >= max_number:
            break

        git_commit = commit.commit
        author = git_commit.author if git_commit else None
        committer = git_commit.committer if git_commit else None
        yield {
            "sha": commit.sha,
            "html_url": commit.html_url,
            "commit": {
                "message": git_commit.message if git_commit else "",
                "author": {
                    "name": author.name if author else None,
                    "date": author.date if author else None,
                },
                "committer": {
                    "name": committer.name if committer else None,
                    "date": committer.date if committer else None,
                },
            },
        }
        count += 1


def get_commit(owner, repo, sha, params=None):
    """
    Retrieve GitHub commit for a given sha.
    Returns a standardized dictionary representing a commit.
    """
    repo_object = pygithub_get_repo(owner, repo)
    commit = repo_object.get_commit(sha)
    commit_dict = {}

    # Append file objects required by collector.py
    commit_dict["files"] = []
    for file in commit.files:
        f = {}
        f["filename"] = file.filename
        commit_dict["files"].append(f)

    # Append object required by ingest.py
    commit_dict["commit"] = {"committer": {"date": commit.commit.committer.date}}
    commit_dict["parents"] = []
    for parent in commit.parents:
        commit_dict["parents"].append({"sha": parent.sha})
    return commit_dict


def get_pull_request(owner, repo, pr_id):
    repo = pygithub_get_repo(owner, repo)
    return repo.get_pull(pr_id)


def get_pull_request_commits(owner, repo, pr_id):
    pr = get_pull_request(owner, repo, pr_id)
    return [commit for commit in pr.get_commits()]
