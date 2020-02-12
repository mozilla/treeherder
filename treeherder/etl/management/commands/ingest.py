import asyncio
import inspect
import logging
from concurrent.futures import ThreadPoolExecutor

import aiohttp
import requests
import taskcluster
import taskcluster.aio
import taskcluster_urls as liburls
from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.etl.db_semaphore import (acquire_connection,
                                         release_connection)
from treeherder.etl.job_loader import JobLoader
from treeherder.etl.push_loader import PushLoader
from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.etl.taskcluster_pulse.handler import (EXCHANGE_EVENT_MAP,
                                                      handleMessage)
from treeherder.model.models import Repository

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

loop = asyncio.get_event_loop()
# Limiting the connection pool just in case we have too many
conn = aiohttp.TCPConnector(limit=10)
# Remove default timeout limit of 5 minutes
timeout = aiohttp.ClientTimeout(total=0)
session = taskcluster.aio.createSession(loop=loop, connector=conn, timeout=timeout)

# Executor to run threads in parallel
executor = ThreadPoolExecutor()

stateToExchange = {}
for key, value in EXCHANGE_EVENT_MAP.items():
    stateToExchange[value] = key


async def handleTaskId(taskId, root_url):
    asyncQueue = taskcluster.aio.Queue({"rootUrl": root_url}, session=session)
    results = await asyncio.gather(asyncQueue.status(taskId), asyncQueue.task(taskId))
    await handleTask({
        "status": results[0]["status"],
        "task": results[1],
    }, root_url)


async def handleTask(task, root_url):
    taskId = task["status"]["taskId"]
    runs = task["status"]["runs"]
    # If we iterate in order of the runs, we will not be able to mark older runs as
    # "retry" instead of exception
    for run in reversed(runs):
        message = {
            "exchange": stateToExchange[run["state"]],
            "payload": {
                "status": {
                    "taskId": taskId,
                    "runs": runs,
                },
                "runId": run["runId"],
            },
            "root_url": root_url,
        }

        try:
            taskRuns = await handleMessage(message, task["task"])
        except Exception as e:
            logger.exception(e)

        if taskRuns:
            # Schedule and run jobs inside the thread pool executor
            jobFutures = [routine_to_future(
                process_job_with_threads, run, root_url) for run in taskRuns]
            await await_futures(jobFutures)


async def fetchGroupTasks(taskGroupId, root_url):
    tasks = []
    query = {}
    continuationToken = ""
    asyncQueue = taskcluster.aio.Queue({"rootUrl": root_url}, session=session)
    while True:
        if continuationToken:
            query = {"continuationToken": continuationToken}
        response = await asyncQueue.listTaskGroup(taskGroupId, query=query)
        tasks.extend(response["tasks"])
        continuationToken = response.get("continuationToken")
        if continuationToken is None:
            break
        logger.info("Requesting more tasks. %s tasks so far...", len(tasks))
    return tasks


async def processTasks(taskGroupId, root_url):
    try:
        tasks = await fetchGroupTasks(taskGroupId, root_url)
        logger.info("We have %s tasks to process", len(tasks))
    except Exception as e:
        logger.exception(e)

    if not tasks:  # No tasks to process
        return

    # Schedule and run tasks inside the thread pool executor
    taskFutures = [routine_to_future(handleTask, task, root_url) for task in tasks]
    await await_futures(taskFutures)


async def routine_to_future(func, *args):
    """Arrange for a function to be executed in the thread pool executor.
    Returns an asyncio.Futures object.
    """
    def _wrap_coroutine(func, *args):
        """Wraps a coroutine into a regular routine to be ran by threads."""
        asyncio.run(func(*args))

    event_loop = asyncio.get_event_loop()
    if inspect.iscoroutinefunction(func):
        return await event_loop.run_in_executor(executor, _wrap_coroutine, func, *args)
    return await event_loop.run_in_executor(executor, func, *args)


async def await_futures(fs):
    """Await for each asyncio.Futures given by fs to copmlete."""
    for fut in fs:
        try:
            await fut
        except Exception as e:
            logger.exception(e)


def process_job_with_threads(pulse_job, root_url):
    acquire_connection()
    logger.info("Loading into DB:\t%s", pulse_job["taskId"])
    JobLoader().process_job(pulse_job, root_url)
    release_connection()


def find_task_id(index_path, root_url):
    index_url = liburls.api(root_url, 'index', 'v1', 'task/{}'.format(index_path))
    response = requests.get(index_url)
    if response.status_code == 404:
        raise Exception("Index URL {} not found".format(index_url))
    return response.json()['taskId']


def get_decision_task_id(project, revision, root_url):
    index_fmt = 'gecko.v2.{}.revision.{}.taskgraph.decision'
    index_path = index_fmt.format(project, revision)
    return find_task_id(index_path, root_url)


class Command(BaseCommand):
    """Management command to ingest data from a single push."""
    help = "Ingests a single push and tasks into Treeherder"

    def add_arguments(self, parser):
        parser.add_argument(
            "ingestion_type",
            nargs=1,
            help="Type of ingestion to do: [task|hg-push|git-commit|pr]"
        )
        parser.add_argument(
            "-p", "--project",
            help="Hg repository to query (e.g. autoland)"
        )
        parser.add_argument(
            "-c", "--commit", "-r", "--revision",
            help="Commit/revision to import"
        )
        parser.add_argument(
            "--enable-eager-celery",
            action="store_true",
            help="This will cause all Celery queues to execute (like log parsing). This will take way longer."
        )
        parser.add_argument(
            "-a", "--ingest-all-tasks",
            action="store_true",
            help="This will cause all tasks associated to a commit to be ingested. This can take a long time."
        )
        parser.add_argument(
            "--root-url",
            dest="root_url",
            default="https://firefox-ci-tc.services.mozilla.com",
            help="Taskcluster root URL for non-Firefox tasks (e.g. https://community-tc.services.mozilla.com"
        )
        parser.add_argument(
            "--task-id",
            dest="taskId",
            nargs="?",
            help="taskId to ingest"
        )
        parser.add_argument(
            "--pr-url",
            dest="prUrl",
            help="Ingest a PR: e.g. https://github.com/mozilla-mobile/android-components/pull/4821"
        )

    def handle(self, *args, **options):
        typeOfIngestion = options["ingestion_type"][0]
        root_url = options["root_url"]

        if typeOfIngestion == "task":
            assert options["taskId"]
            loop.run_until_complete(handleTaskId(options["taskId"], root_url))
        elif typeOfIngestion == "pr":
            assert options["prUrl"]
            pr_url = options["prUrl"]
            splitUrl = pr_url.split("/")
            org = splitUrl[3]
            repo = splitUrl[4]
            pulse = {
                "exchange": "exchange/taskcluster-github/v1/pull-request",
                "routingKey": "primary.{}.{}.synchronize".format(org, repo),
                "payload": {
                    "repository": repo,
                    "organization": org,
                    "action": "synchronize",
                    "details": {
                        "event.pullNumber": splitUrl[6],
                        "event.base.repo.url": "https://github.com/{}/{}.git".format(org, repo),
                        "event.head.repo.url": "https://github.com/{}/{}.git".format(org, repo),
                    },
                }
            }
            PushLoader().process(pulse["payload"], pulse["exchange"], root_url)
        elif typeOfIngestion == "git-push":
            from treeherder.model.models import Push
            Push.objects.filter().delete()
            pulse = {
                "exchange": "exchange/taskcluster-github/v1/push",
                "routingKey": "primary.mozilla-mobile.android-components",
                "payload": {
                    "organization": "mozilla-mobile",
                    "details": {
                        "event.base.ref": "refs/heads/master",
                        # "event.base.repo.name": "android-components",
                        # "event.base.repo.url": "https://github.com/mozilla-mobile/android-components.git",
                        # "event.base.sha": "7285afe57ae6207fdb5d6db45133dac2053b7820",
                        # "event.base.user.login": "bors[bot]",
                        # "event.head.ref": "refs/heads/master",
                        # "event.head.repo.name": "android-components",
                        # "event.head.repo.url": "https://github.com/mozilla-mobile/android-components.git",
                        # "event.head.sha": "5fdb785b28b356f50fc1d9cb180d401bb03fc1f1",
                        # "event.head.user.login": "bors[bot]",
                        # "event.head.user.id": 26634292,
                        # "event.type": "push",
                        # "event.base.repo.branch": "master",
                        # "event.head.repo.branch": "master",
                        # "event.head.user.email": "bors@users.noreply.github.com"
                    },
                    "installationId": 5110595,
                    "tasks_for": "github-push",
                    "branch": "master",
                    "repository": "android-components",
                    "eventId": "6c722d22-4dac-11ea-8d13-04e94ccdb80b",
                    "version": 1,
                    "body": {
                        "ref": "refs/heads/master",
                        "before": "7285afe57ae6207fdb5d6db45133dac2053b7820",
                        "after": "5fdb785b28b356f50fc1d9cb180d401bb03fc1f1",
                        "repository": {
                            "id": 126199585,
                            "node_id": "MDEwOlJlcG9zaXRvcnkxMjYxOTk1ODU=",
                            "name": "android-components",
                            "full_name": "mozilla-mobile/android-components",
                            "private": False,
                            "owner": {
                                "name": "mozilla-mobile",
                                "email": None,
                                "login": "mozilla-mobile",
                                "id": 22351667,
                                "node_id": "MDEyOk9yZ2FuaXphdGlvbjIyMzUxNjY3",
                                "avatar_url": "https://avatars3.githubusercontent.com/u/22351667?v=4",
                                "gravatar_id": "",
                                "url": "https://api.github.com/users/mozilla-mobile",
                                "html_url": "https://github.com/mozilla-mobile",
                                "followers_url": "https://api.github.com/users/mozilla-mobile/followers",
                                "following_url": "https://api.github.com/users/mozilla-mobile/following{/other_user}",
                                "gists_url": "https://api.github.com/users/mozilla-mobile/gists{/gist_id}",
                                "starred_url": "https://api.github.com/users/mozilla-mobile/starred{/owner}{/repo}",
                                "subscriptions_url": "https://api.github.com/users/mozilla-mobile/subscriptions",
                                "organizations_url": "https://api.github.com/users/mozilla-mobile/orgs",
                                "repos_url": "https://api.github.com/users/mozilla-mobile/repos",
                                "events_url": "https://api.github.com/users/mozilla-mobile/events{/privacy}",
                                "received_events_url": "https://api.github.com/users/mozilla-mobile/received_events",
                                "type": "Organization",
                                "site_admin": False
                            },
                            "html_url": "https://github.com/mozilla-mobile/android-components",
                            "description": "A collection of Android libraries to build browsers or browser-like applications.",
                            "fork": False,
                            "url": "https://github.com/mozilla-mobile/android-components",
                            "forks_url": "https://api.github.com/repos/mozilla-mobile/android-components/forks",
                            "keys_url": "https://api.github.com/repos/mozilla-mobile/android-components/keys{/key_id}",
                            "collaborators_url": "https://api.github.com/repos/mozilla-mobile/android-components/collaborators{/collaborator}",
                            "teams_url": "https://api.github.com/repos/mozilla-mobile/android-components/teams",
                            "hooks_url": "https://api.github.com/repos/mozilla-mobile/android-components/hooks",
                            "issue_events_url": "https://api.github.com/repos/mozilla-mobile/android-components/issues/events{/number}",
                            "events_url": "https://api.github.com/repos/mozilla-mobile/android-components/events",
                            "assignees_url": "https://api.github.com/repos/mozilla-mobile/android-components/assignees{/user}",
                            "branches_url": "https://api.github.com/repos/mozilla-mobile/android-components/branches{/branch}",
                            "tags_url": "https://api.github.com/repos/mozilla-mobile/android-components/tags",
                            "blobs_url": "https://api.github.com/repos/mozilla-mobile/android-components/git/blobs{/sha}",
                            "git_tags_url": "https://api.github.com/repos/mozilla-mobile/android-components/git/tags{/sha}",
                            "git_refs_url": "https://api.github.com/repos/mozilla-mobile/android-components/git/refs{/sha}",
                            "trees_url": "https://api.github.com/repos/mozilla-mobile/android-components/git/trees{/sha}",
                            "statuses_url": "https://api.github.com/repos/mozilla-mobile/android-components/statuses/{sha}",
                            "languages_url": "https://api.github.com/repos/mozilla-mobile/android-components/languages",
                            "stargazers_url": "https://api.github.com/repos/mozilla-mobile/android-components/stargazers",
                            "contributors_url": "https://api.github.com/repos/mozilla-mobile/android-components/contributors",
                            "subscribers_url": "https://api.github.com/repos/mozilla-mobile/android-components/subscribers",
                            "subscription_url": "https://api.github.com/repos/mozilla-mobile/android-components/subscription",
                            "commits_url": "https://api.github.com/repos/mozilla-mobile/android-components/commits{/sha}",
                            "git_commits_url": "https://api.github.com/repos/mozilla-mobile/android-components/git/commits{/sha}",
                            "comments_url": "https://api.github.com/repos/mozilla-mobile/android-components/comments{/number}",
                            "issue_comment_url": "https://api.github.com/repos/mozilla-mobile/android-components/issues/comments{/number}",
                            "contents_url": "https://api.github.com/repos/mozilla-mobile/android-components/contents/{+path}",
                            "compare_url": "https://api.github.com/repos/mozilla-mobile/android-components/compare/{base}...{head}",
                            "merges_url": "https://api.github.com/repos/mozilla-mobile/android-components/merges",
                            "archive_url": "https://api.github.com/repos/mozilla-mobile/android-components/{archive_format}{/ref}",
                            "downloads_url": "https://api.github.com/repos/mozilla-mobile/android-components/downloads",
                            "issues_url": "https://api.github.com/repos/mozilla-mobile/android-components/issues{/number}",
                            "pulls_url": "https://api.github.com/repos/mozilla-mobile/android-components/pulls{/number}",
                            "milestones_url": "https://api.github.com/repos/mozilla-mobile/android-components/milestones{/number}",
                            "notifications_url": "https://api.github.com/repos/mozilla-mobile/android-components/notifications{?since,all,participating}",
                            "labels_url": "https://api.github.com/repos/mozilla-mobile/android-components/labels{/name}",
                            "releases_url": "https://api.github.com/repos/mozilla-mobile/android-components/releases{/id}",
                            "deployments_url": "https://api.github.com/repos/mozilla-mobile/android-components/deployments",
                            "created_at": 1521645843,
                            "updated_at": "2020-02-12T15:21:24Z",
                            "pushed_at": 1581521353,
                            "git_url": "git://github.com/mozilla-mobile/android-components.git",
                            "ssh_url": "git@github.com:mozilla-mobile/android-components.git",
                            "clone_url": "https://github.com/mozilla-mobile/android-components.git",
                            "svn_url": "https://github.com/mozilla-mobile/android-components",
                            "homepage": "https://mozac.org",
                            "size": 61634,
                            "stargazers_count": 1214,
                            "watchers_count": 1214,
                            "language": "Kotlin",
                            "has_issues": True,
                            "has_projects": False,
                            "has_downloads": True,
                            "has_wiki": False,
                            "has_pages": True,
                            "forks_count": 268,
                            "mirror_url": None,
                            "archived": False,
                            "disabled": False,
                            "open_issues_count": 684,
                            "license": {
                                "key": "mpl-2.0",
                                "name": "Mozilla Public License 2.0",
                                "spdx_id": "MPL-2.0",
                                "url": "https://api.github.com/licenses/mpl-2.0",
                                "node_id": "MDc6TGljZW5zZTE0"
                            },
                            "forks": 268,
                            "open_issues": 684,
                            "watchers": 1214,
                            "default_branch": "master",
                            "stargazers": 1214,
                            "master_branch": "master",
                            "organization": "mozilla-mobile"
                        },
                        "pusher": {
                            "name": "bors[bot]",
                            "email": None
                        },
                        "organization": {
                            "login": "mozilla-mobile",
                            "id": 22351667,
                            "node_id": "MDEyOk9yZ2FuaXphdGlvbjIyMzUxNjY3",
                            "url": "https://api.github.com/orgs/mozilla-mobile",
                            "repos_url": "https://api.github.com/orgs/mozilla-mobile/repos",
                            "events_url": "https://api.github.com/orgs/mozilla-mobile/events",
                            "hooks_url": "https://api.github.com/orgs/mozilla-mobile/hooks",
                            "issues_url": "https://api.github.com/orgs/mozilla-mobile/issues",
                            "members_url": "https://api.github.com/orgs/mozilla-mobile/members{/member}",
                            "public_members_url": "https://api.github.com/orgs/mozilla-mobile/public_members{/member}",
                            "avatar_url": "https://avatars3.githubusercontent.com/u/22351667?v=4",
                            "description": "Mozilla Mobile Applications"
                        },
                        "sender": {
                            "login": "bors[bot]",
                            "id": 26634292,
                            "node_id": "MDM6Qm90MjY2MzQyOTI=",
                            "avatar_url": "https://avatars3.githubusercontent.com/in/1847?v=4",
                            "gravatar_id": "",
                            "url": "https://api.github.com/users/bors%5Bbot%5D",
                            "html_url": "https://github.com/apps/bors",
                            "followers_url": "https://api.github.com/users/bors%5Bbot%5D/followers",
                            "following_url": "https://api.github.com/users/bors%5Bbot%5D/following{/other_user}",
                            "gists_url": "https://api.github.com/users/bors%5Bbot%5D/gists{/gist_id}",
                            "starred_url": "https://api.github.com/users/bors%5Bbot%5D/starred{/owner}{/repo}",
                            "subscriptions_url": "https://api.github.com/users/bors%5Bbot%5D/subscriptions",
                            "organizations_url": "https://api.github.com/users/bors%5Bbot%5D/orgs",
                            "repos_url": "https://api.github.com/users/bors%5Bbot%5D/repos",
                            "events_url": "https://api.github.com/users/bors%5Bbot%5D/events{/privacy}",
                            "received_events_url": "https://api.github.com/users/bors%5Bbot%5D/received_events",
                            "type": "Bot",
                            "site_admin": False
                        },
                        "installation": {
                            "id": 5110595,
                            "node_id": "MDIzOkludGVncmF0aW9uSW5zdGFsbGF0aW9uNTExMDU5NQ=="
                        },
                        "created": False,
                        "deleted": False,
                        "forced": False,
                        "base_ref": None,
                        "compare": "https://github.com/mozilla-mobile/android-components/compare/7285afe57ae6...5fdb785b28b3",
                        "commits": [
                            {
                                "id": "8a4cb15deb60e490ec7dfae03ca350bde3688dcb",
                                "tree_id": "f7071289b2d2e51edd7ecf525132ef60e19e554e",
                                "distinct": True,
                                "message": "Closes #4779 - Fix `ExperimentsDebugActivity` command to change server",
                                "timestamp": "2020-02-06T13:22:20-06:00",
                                "url": "https://github.com/mozilla-mobile/android-components/commit/8a4cb15deb60e490ec7dfae03ca350bde3688dcb",
                                "author": {
                                "name": "Travis Long",
                                "email": "tlong@mozilla.com",
                                "username": "travis79"
                                },
                                "committer": {
                                "name": "Travis Long",
                                "email": "tlong@mozilla.com",
                                "username": "travis79"
                                },
                                "added": [],
                                "removed": [],
                                "modified": [
                                "components/service/experiments/src/main/java/mozilla/components/service/experiments/ExperimentsUpdater.kt",
                                "components/service/experiments/src/main/java/mozilla/components/service/experiments/debug/ExperimentsDebugActivity.kt"
                                ]
                            },
                            {
                                "id": "5fdb785b28b356f50fc1d9cb180d401bb03fc1f1",
                                "tree_id": "410cf16b218c00bf743585d1d9cce5d89f418b97",
                                "distinct": True,
                                "message": "[ci skip][skip ci][skip netlify] -bors-master-tmp-5835",
                                "timestamp": "2020-02-12T15:29:12Z",
                                "url": "https://github.com/mozilla-mobile/android-components/commit/5fdb785b28b356f50fc1d9cb180d401bb03fc1f1",
                                "author": {
                                "name": "bors[bot]",
                                "email": "26634292+bors[bot]@users.noreply.github.com",
                                "username": "bors[bot]"
                                },
                                "committer": {
                                "name": "GitHub",
                                "email": "noreply@github.com",
                                "username": "web-flow"
                                },
                                "added": [],
                                "removed": [],
                                "modified": [
                                "components/service/experiments/src/main/java/mozilla/components/service/experiments/ExperimentsUpdater.kt",
                                "components/service/experiments/src/main/java/mozilla/components/service/experiments/debug/ExperimentsDebugActivity.kt"
                                ]
                            }
                        ],
                        "head_commit": {
                            "id": "5fdb785b28b356f50fc1d9cb180d401bb03fc1f1",
                            "tree_id": "410cf16b218c00bf743585d1d9cce5d89f418b97",
                            "distinct": True,
                            "message": "[ci skip][skip ci][skip netlify] -bors-master-tmp-5835",
                            "timestamp": "2020-02-12T15:29:12Z",
                            "url": "https://github.com/mozilla-mobile/android-components/commit/5fdb785b28b356f50fc1d9cb180d401bb03fc1f1",
                            "author": {
                                "name": "bors[bot]",
                                "email": "26634292+bors[bot]@users.noreply.github.com",
                                "username": "bors[bot]"
                            },
                            "committer": {
                                "name": "GitHub",
                                "email": "noreply@github.com",
                                "username": "web-flow"
                            },
                            "added": [],
                            "removed": [],
                            "modified": [
                                "components/service/experiments/src/main/java/mozilla/components/service/experiments/ExperimentsUpdater.kt",
                                "components/service/experiments/src/main/java/mozilla/components/service/experiments/debug/ExperimentsDebugActivity.kt"
                            ]
                        }
                    },
                }
            }
            PushLoader().process(pulse["payload"], pulse["exchange"], root_url)
        elif typeOfIngestion == "push":
            if not options["enable_eager_celery"]:
                logger.info(
                    "If you want all logs to be parsed use --enable-eager-celery"
                )
            else:
                # Make sure all tasks are run synchronously / immediately
                settings.CELERY_TASK_ALWAYS_EAGER = True

            # get reference to repo and ingest this particular revision for this project
            project = options["project"]
            commit = options["commit"]
            repo = Repository.objects.get(name=project, active_status="active")
            pushlog_url = "%s/json-pushes/?full=1&version=2" % repo.url
            process = HgPushlogProcess()
            process.run(pushlog_url, project, changeset=commit, last_push_id=None)

            if options["ingest_all_tasks"]:
                gecko_decision_task = get_decision_task_id(project, commit, repo.tc_root_url)
                logger.info("## START ##")
                loop.run_until_complete(processTasks(gecko_decision_task, repo.tc_root_url))
                logger.info("## END ##")
            else:
                logger.info(
                    "You can ingest all tasks for a push with -a/--ingest-all-tasks."
                )
