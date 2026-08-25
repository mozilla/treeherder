from datetime import UTC, datetime

from github import Auth, Github

from treeherder.config.settings import GITHUB_TOKEN

# per_page=100 is GitHub's max and matches collector MAX_ITEMS, so typical
# list endpoints complete in one HTTP call (PyGithub defaults to 30).
# lazy=True builds repo/PR objects from URLs without GET /repos or GET /pulls.
# seconds_between_requests=0 matches the old fetch_json client (no 250ms pause).
_GITHUB_KWARGS = {
    "per_page": 100,
    "lazy": True,
    "seconds_between_requests": 0,
}

if GITHUB_TOKEN:
    github = Github(auth=Auth.Token(GITHUB_TOKEN), **_GITHUB_KWARGS)
else:
    github = Github(**_GITHUB_KWARGS)


def get_repo(owner, repo):
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
    Yields standardized dictionaries representing releases.
    """
    paginated_releases = get_repo(owner=owner, repo=repo).get_releases()

    max_number, since_dt = _parse_list_options(params)
    count = 0

    for release in paginated_releases:
        # PyGithub returns releases in reverse chronological order
        # Stop immediately if releases older than the since_dt are found
        release_dt = release.published_at
        if since_dt and release_dt:
            if release_dt.tzinfo is None:
                release_dt.replace(tzinfo=UTC)
            if release.published_at < since_dt:
                break
        yield {
            "id": release.id,
            "name": release.name,
            "tag_name": release.tag_name,
            "published_at": release.published_at,
            "html_url": release.html_url,
            "author": {"login": release.author.login if release.author else "unknown"},
        }
        count += 1
        if max_number and count >= max_number:
            break


def get_comparison(owner, repo, base, head):
    """Return the PyGithub Comparison for ``base...head``."""
    return get_repo(owner, repo).compare(base, head)


def compare_shas(owner, repo, base, head):
    """Return the list of PyGithub commits between ``base`` and ``head``.

    Materialized as a list because GithubTransformer.process_push indexes
    ``commits[-1]`` and then iterates the same sequence.
    """
    return list(get_comparison(owner, repo, base, head).commits)


def get_all_commits(owner, repo, params=None):
    """
    Retrieve GitHub commits for a given repository.

    ``params`` accepts the same collector gh_options as ``get_releases``:
    ``number`` (max commits to return) and ``since`` (ISO-8601 string or datetime).

    Yields standardized dictionaries matching the GitHub list-commits JSON shape
    used by collector.py and ingest.py.
    """
    max_number, since_dt = _parse_list_options(params)
    repo_object = get_repo(owner, repo)
    kwargs = {}
    if since_dt is not None:
        kwargs["since"] = since_dt

    count = 0
    for commit in repo_object.get_commits(**kwargs):
        git_commit = commit.commit
        author = git_commit.author if git_commit else None
        committer = git_commit.committer if git_commit else None
        yield {
            "sha": commit.sha,
            "html_url": commit.html_url,
            "commit": {
                "message": git_commit.message if git_commit else "",
                "author": {
                    "name": getattr(author, "name", None),
                    "date": getattr(author, "date", None),
                },
                "committer": {
                    "name": getattr(committer, "name", None),
                    "date": getattr(committer, "date", None),
                },
            },
        }
        count += 1
        if max_number and count >= max_number:
            break


def get_commit(owner, repo, sha, params=None):
    """
    Retrieve GitHub commit for a given sha.
    Returns a standardized dictionary representing a commit.
    """
    repo_object = get_repo(owner, repo)
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
    repo = get_repo(owner, repo)
    return repo.get_pull(pr_id)


def get_pull_request_commits(owner, repo, pr_id):
    """Return PR commits as a list (process_push needs ``commits[-1]``)."""
    pr = get_pull_request(owner, repo, pr_id)
    return list(pr.get_commits())
