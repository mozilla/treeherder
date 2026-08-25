from datetime import UTC, datetime

from github import Auth, Github
from github.GitRelease import GitRelease

from treeherder.config.settings import GITHUB_TOKEN

if GITHUB_TOKEN:
    auth = Auth.Token(GITHUB_TOKEN)
    github = Github(auth=auth)
else:
    github = Github()


def pygithub_get_repo(owner, repo):
    return github.get_repo(f"{owner}/{repo}")


def get_releases(owner, repo, params=None):
    """
    Retrieve GitHub releases for a given repository.
    Returns a list of standardized dictionaries representing releases.
    """
    paginated_releases = pygithub_get_repo(owner=owner, repo=repo).get_releases()

    releases: list[GitRelease] = []
    since_dt = None
    max_number = None

    if params:
        max_number = params.get("number")
        since_dt = params.get("since", None)
        if since_dt:
            since_dt = datetime.fromisoformat(since_dt)
            if since_dt.tzinfo is None:
                since_dt.replace(tzinfo=UTC)

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


def compare_shas(owner, repo, base, head, get_comparison_object=False):
    repo = pygithub_get_repo(owner, repo)
    comparison = repo.compare(base, head)
    if get_comparison_object:
        return comparison
    return (commit for commit in comparison.commits)


def get_all_commits(owner, repo, params=None):
    """
    Retrieve GitHub commits for a given repository.
    Returns a list of standardized dictionaries representing commits.
    """
    repo_object = pygithub_get_repo(owner, repo)
    since_dt = None
    max_number = None

    if params:
        max_number = params.get("number")
        since_dt = params.get("since", None)
        if since_dt:
            since_dt = datetime.fromisoformat(since_dt)
            if since_dt.tzinfo is None:
                since_dt = since_dt.replace(tzinfo=UTC)

    if since_dt:
        paginated_commits = repo_object.get_commits(since=since_dt)
    else:
        paginated_commits = repo_object.get_commits()

    commits = []
    for commit in paginated_commits:
        if max_number and len(commits) >= max_number:
            break

        author = commit.commit.author
        commits.append(
            {
                "sha": commit.sha,
                "html_url": commit.html_url,
                "commit": {
                    "message": commit.commit.message,
                    "author": {
                        "name": author.name if author else "unknown",
                        "date": author.date if author else None,
                    },
                },
            }
        )

    return commits


def get_commit(owner, repo, sha, params=None):
    """
    Retrieve GitHub commit for a given sha.
    Returns a standardized dictionary representing a commit.
    """
    repo_object = pygithub_get_repo(owner, repo)
    commit = repo_object.get_commit(sha)
    commit_dict = {"sha": commit.sha}

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
    return (commit for commit in pr.get_commits())
