""" Collector, grabs changes in various sources and put them in a DB.
"""
import json
import os

import github3

from treeherder.changelog.filters import Filters

MAX_ITEMS = 100
CFG = os.path.join(os.path.dirname(__file__), "repositories.json")

with open(CFG) as f:
    CFG = json.loads(f.read())


class GitHub:
    def __init__(self):
        self.token = os.environ["GITHUB_CLIENT_SECRET"]
        self.id = os.environ["GITHUB_CLIENT_ID"]
        self.gh = github3.login(token=self.token, two_factor_callback=self._2FA)
        self.filters = Filters()

    def _2FA(self):
        """ The two-factor authentication is useful when running Github from a
        personal github account.
        """
        # XXX add a cheeck to know if we run into the CI, if it's the case
        # and this function is called, we need to raise an error.
        code = ""
        while not code:
            code = input("Enter 2FA code: ")
        return code

    def get_changes(self, user, repository, **kw):
        repo = self.gh.repository(user, repository)
        filters = kw.get("filters")

        gh_options = {"number": kw.get("number", MAX_ITEMS)}

        for release in repo.releases(**gh_options):
            release = json.loads(release.as_json())
            release["files"] = []
            # no "since" option for releases() we filter manually here
            if "since" in kw and release["published_at"] <= kw["since"]:
                continue
            name = release["name"] or release["tag_name"]
            yield {
                "date": release["published_at"],
                "author": release["author"]["login"],
                "message": "Released " + name,
                "id": release["id"],
                "type": "release",
                "url": release["html_url"],
            }

        if "since" in kw:
            gh_options["since"] = kw["since"]

        for commit in repo.commits(**gh_options):
            commit = json.loads(commit.as_json())
            if filters:
                for filter in filters:
                    if isinstance(filter, list) and filter[0] == "filter_by_path":
                        commit["files"] = repo.commit(commit["sha"]).files
                        break

            message = commit["commit"]["message"]
            message = message.split("\n")[0]
            res = {
                "date": commit["commit"]["author"]["date"],
                "author": commit["commit"]["author"]["name"],
                "message": message,
                "id": commit["sha"],
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
