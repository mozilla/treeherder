import logging

import environ
import newrelic.agent
from django.core.exceptions import ObjectDoesNotExist

from treeherder.etl.common import (fetch_json,
                                   to_timestamp)
from treeherder.etl.push import store_push_data
from treeherder.model.models import Repository

env = environ.Env()
logger = logging.getLogger(__name__)


class PushLoader:
    """Transform and load a list of pushes"""

    def process(self, message_body, exchange, root_url):
        transformer = self.get_transformer_class(exchange)(message_body)
        try:
            newrelic.agent.add_custom_parameter("url", transformer.repo_url)
            newrelic.agent.add_custom_parameter("branch", transformer.branch)
            repos = Repository.objects
            if transformer.branch:
                repos = repos.filter(branch__regex="(^|,)%s($|,)" % transformer.branch)
            else:
                repos = repos.filter(branch=None)
            repo = repos.get(url=transformer.repo_url, active_status="active")
            newrelic.agent.add_custom_parameter("repository", repo.name)

            if repo.tc_root_url != root_url:
                repo_info = transformer.get_info()
                repo_info.update({
                    "url": transformer.repo_url,
                    "branch": transformer.branch,
                    "root_url": root_url,
                })
                newrelic.agent.record_custom_event("skip_repository_wrong_root_url",
                                                   repo_info)
                logger.warning("Skipping push for %s with incorrect root_url %s",
                               repo.name, root_url)
                return

        except ObjectDoesNotExist:
            repo_info = transformer.get_info()
            repo_info.update({
                "url": transformer.repo_url,
                "branch": transformer.branch,
            })
            newrelic.agent.record_custom_event("skip_unknown_repository",
                                               repo_info)
            logger.warning("Skipping unsupported repo: %s %s",
                           transformer.repo_url,
                           transformer.branch)
            return

        transformed_data = transformer.transform(repo.name)

        logger.info("Storing push for %s %s %s",
                    repo.name,
                    transformer.repo_url,
                    transformer.branch)
        store_push_data(repo, [transformed_data])

    def get_transformer_class(self, exchange):
        if "github" in exchange:
            if exchange.endswith("push"):
                return GithubPushTransformer
            elif exchange.endswith("pull-request"):
                return GithubPullRequestTransformer
        elif "/hgpushes/" in exchange:
            return HgPushTransformer
        raise PulsePushError(
            "Unsupported push exchange: {}".format(exchange))


class GithubTransformer:

    CREDENTIALS = {
        "client_id": env("GITHUB_CLIENT_ID", default=None),
        "client_secret": env("GITHUB_CLIENT_SECRET", default=None),
    }

    def __init__(self, message_body):
        self.message_body = message_body
        self.repo_url = message_body["details"]["event.head.repo.url"].replace(".git", "")
        self.branch = self.get_branch()

    def get_branch(self):
        return self.message_body["details"]["event.base.repo.branch"]

    def get_info(self):
        # flatten the data a bit so it will show in new relic as fields
        info = self.message_body["details"].copy()
        info.update({
            "organization": self.message_body["organization"],
            "repository": self.message_body["repository"]
        })
        return info

    def fetch_push(self, url, repository):
        params = {}
        params.update(self.CREDENTIALS)

        logger.info("Fetching push details: %s", url)

        commits = self.get_cleaned_commits(fetch_json(url, params))
        head_commit = commits[-1]
        push = {
            "revision": head_commit["sha"],
            "push_timestamp": to_timestamp(
                head_commit["commit"]["author"]["date"]),
            "author": head_commit["commit"]["author"]["email"],
        }

        revisions = []
        for commit in commits:
            revisions.append({
                "comment": commit["commit"]["message"],
                "author": u"{} <{}>".format(
                    commit["commit"]["author"]["name"],
                    commit["commit"]["author"]["email"]),
                "revision": commit["sha"]
            })

        push["revisions"] = revisions
        return push

    def get_cleaned_commits(self, commits):
        """Allow a subclass to change the order of the commits"""
        return commits


class GithubPushTransformer(GithubTransformer):
    # {
    #     organization:mozilla - services
    #     details:{
    #         event.type:push
    #         event.base.repo.branch:master
    #         event.head.repo.branch:master
    #         event.head.user.login:mozilla-cloudops-deploy
    #         event.head.repo.url:https://github.com/mozilla-services/cloudops-jenkins.git
    #         event.head.sha:845aa1c93726af92accd9b748ea361a37d5238b6
    #         event.head.ref:refs/heads/master
    #         event.head.user.email:mozilla-cloudops-deploy@noreply.github.com
    #     }
    #     repository:cloudops-jenkins
    #     version:1
    # }

    URL_BASE = "https://api.github.com/repos/{}/{}/compare/{}...{}"

    def transform(self, repository):
        push_url = self.URL_BASE.format(
            self.message_body["organization"],
            self.message_body["repository"],
            self.message_body["details"]["event.base.sha"],
            self.message_body["details"]["event.head.sha"],
        )
        return self.fetch_push(push_url, repository)

    def get_cleaned_commits(self, compare):
        return compare["commits"]


class GithubPullRequestTransformer(GithubTransformer):
    # {
    #     "organization": "mozilla",
    #     "action": "synchronize",
    #     "details": {
    #         "event.type": "pull_request.synchronize",
    #         "event.base.repo.branch": "master",
    #         "event.pullNumber": "1692",
    #         "event.base.user.login": "mozilla",
    #         "event.base.repo.url": "https: // github.com / mozilla / treeherder.git",
    #         "event.base.sha": "ff6a66a27c2c234e5820b8ffe48f17d85f1eb2db",
    #         "event.base.ref": "master",
    #         "event.head.user.login": "mozilla",
    #         "event.head.repo.url": "https: // github.com / mozilla / treeherder.git",
    #         "event.head.repo.branch": "github - pulse - pushes",
    #         "event.head.sha": "0efea0fa1396369b5058e16139a8ab51cdd7bd29",
    #         "event.head.ref": "github - pulse - pushes",
    #         "event.head.user.email": "mozilla@noreply.github.com",
    #     },
    #     "repository": "treeherder",
    #     "version": 1
    # }

    URL_BASE = "https://api.github.com/repos/{}/{}/pulls/{}/commits"

    def get_branch(self):
        """
        Pull requests don't use the actual branch, just the string "pull request"
        """
        return "pull request"

    def transform(self, repository):
        pr_url = self.URL_BASE.format(
            self.message_body["organization"],
            self.message_body["repository"],
            self.message_body["details"]["event.pullNumber"]
        )

        return self.fetch_push(pr_url, repository)


class HgPushTransformer:
    # {
    #   "root": {
    #     "payload": {
    #       "pushlog_pushes": [
    #         {
    #           "time": 14698302460,
    #           "push_full_json_url": "https://hg.mozilla.org/try/json-pushes?version=2&full=1&startID=136597&endID=136598",
    #           "pushid": 136598,
    #           "push_json_url": " https: //hg.mozilla.org/try/json-pushes?version=2&startID=136597&endID=136598",
    #           "user": " james@hoppipolla.co.uk"
    #         }
    #       ],
    #       "heads": [
    #         "2f77bc4f354d9ba67ea5270b2fc789f4b0521287"
    #       ],
    #       "repo_url": "https://hg.mozilla.org/try",
    #       "_meta": {
    #         "sent": "2016-07-29T22:11:18.503365",
    #         "routing_key": "try",
    #         "serializer": "json",
    #         "exchange": "exchange/hgpushes/v1"
    #       }
    #     }
    #   }
    # }

    def __init__(self, message_body):
        self.message_body = message_body
        self.repo_url = message_body["payload"]["repo_url"]
        self.branch = None

    def get_info(self):
        return self.message_body["payload"]

    def transform(self, repository):
        logger.info("transforming for %s", repository)
        url = self.message_body["payload"]["pushlog_pushes"][0]["push_full_json_url"]
        return self.fetch_push(url, repository)

    def fetch_push(self, url, repository, sha=None):
        newrelic.agent.add_custom_parameter("sha", sha)

        logger.info("fetching for %s %s", repository, url)
        # there will only ever be one, with this url
        push = list(fetch_json(url)["pushes"].values())[0]

        commits = []
        # we only want to ingest the last 200 commits for each push,
        # to protect against the 5000+ commit merges on release day uplift.
        for commit in push['changesets'][-200:]:
            commits.append({
                "revision": commit["node"],
                "author": commit["author"],
                "comment": commit["desc"],
            })

        return {
            "revision": commits[-1]["revision"],
            "author": push["user"],
            "push_timestamp": push["date"],
            "revisions": commits,
        }


class PulsePushError(ValueError):
    pass
