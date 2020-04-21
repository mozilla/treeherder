""" Collector, grabs changes in various sources and put them in a DB.
"""
import json
import os

from treeherder.changelog.filters import Filters
from treeherder.utils import github

MAX_ITEMS = 100
CFG = os.path.join(os.path.dirname(__file__), "repositories.json")

with open(CFG) as f:
    CFG = json.loads(f.read())


class GitHub:
    def __init__(self):
        self.filters = Filters()

    def get_changes(self, **kw):
        owner = kw["user"]
        repository = kw["repository"]
        filters = kw.get("filters")
        gh_options = {"number": kw.get("number", MAX_ITEMS)}

        for release in github.get_releases(owner, repository, params=gh_options):
            release["files"] = []
            # no "since" option for releases() we filter manually here
            if "since" in kw and release["published_at"] <= kw["since"]:
                continue
            name = release["name"] or release["tag_name"]
            yield {
                "date": release["published_at"],
                "author": release["author"]["login"],
                "message": "Released " + name,
                "remote_id": release["id"],
                "type": "release",
                "url": release["html_url"],
            }

        if "since" in kw:
            gh_options["since"] = kw["since"]

        for commit in github.commits_info(owner, repository, params=gh_options):
            if filters:
                for filter in filters:
                    if isinstance(filter, list) and filter[0] == "filter_by_path":
                        commit_info = github.commit_info(owner, repository, commit["sha"])
                        commit["files"] = commit_info["files"]
                        break

            message = commit["commit"]["message"]
            message = message.split("\n")[0]
            res = {
                "date": commit["commit"]["author"]["date"],
                "author": commit["commit"]["author"]["name"],
                "message": message,
                "remote_id": commit["sha"],
                "type": "commit",
                "url": commit["html_url"],
                "files": [f["filename"] for f in commit.get("files", [])],
            }
            res = self.filters(res, filters)
            if res:
                yield res


def collect(since):
    readers = {"github": GitHub()}

    for repo_info in CFG["repositories"]:
        source = dict(repo_info["source"])
        reader = readers.get(source["type"])
        if not reader:
            raise NotImplementedError(source["type"])
        source["since"] = since
        for change in reader.get_changes(**source):
            change.update(repo_info["metadata"])  # XXX duplicated for now
            yield change
