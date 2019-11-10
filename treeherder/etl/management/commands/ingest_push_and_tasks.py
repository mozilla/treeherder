import asyncio
import logging

import aiohttp
import taskcluster
import taskcluster.aio
from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.etl.job_loader import JobLoader
from treeherder.etl.push_loader import PushLoader
from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.etl.taskcluster_pulse.handler import (EXCHANGE_EVENT_MAP,
                                                      handleMessage)
from treeherder.model.models import Repository

logger = logging.getLogger(__name__)
loop = asyncio.get_event_loop()
# Limiting the connection pool just in case we have too many
conn = aiohttp.TCPConnector(limit=10)
# Remove default timeout limit of 5 minutes
timeout = aiohttp.ClientTimeout(total=0)
session = taskcluster.aio.createSession(loop=loop, connector=conn, timeout=timeout)

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
            if taskRuns:
                for run in taskRuns:
                    logger.info("Loading into DB:\t%s/%s", taskId, run["retryId"])
                    # XXX: This seems our current bottleneck
                    JobLoader().process_job(run, root_url)
        except Exception as e:
            logger.exception(e)


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
    tasks = await fetchGroupTasks(taskGroupId, root_url)
    asyncTasks = []
    logger.info("We have %s tasks to process", len(tasks))
    for task in tasks:
        asyncTasks.append(asyncio.create_task(handleTask(task, root_url)))

    await asyncio.gather(*asyncTasks)


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
            "-c", "--commit",
            help="Commit to import"
        )
        parser.add_argument(
            "--ingest-all-tasks",
            nargs="?",
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
            pass
        elif typeOfIngestion == "hg-push":
            project = options["project"]
            commit = options["commit"]

            # get reference to repo
            repo = Repository.objects.get(name=project, active_status="active")
            fetch_push_id = None

            # make sure all tasks are run synchronously / immediately
            settings.CELERY_TASK_ALWAYS_EAGER = True

            # get hg pushlog
            pushlog_url = "%s/json-pushes/?full=1&version=2" % repo.url

            # ingest this particular revision for this project
            process = HgPushlogProcess()
            # Use the actual push SHA, in case the changeset specified was a tag
            # or branch name (eg tip). HgPushlogProcess returns the full SHA.
            process.run(pushlog_url, project, changeset=commit, last_push_id=fetch_push_id)

            if options["ingest_all_tasks"]:
                raise Exception("This is not yet implemented")
                # XXX: Need logic to get from project/revision to taskGroupId
                logger.info("## START ##")
                loop.run_until_complete(processTasks("ZYnMSfwCS5Cc_Wi_e-ZlSA", repo.tc_root_url))
                logger.info("## END ##")
