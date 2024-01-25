# Code imported from https://github.com/taskcluster/taskcluster/blob/32629c562f8d6f5a6b608a3141a8ee2e0984619f/services/treeherder/src/handler.js
import logging
import os

import environ
import jsonschema
import slugid
import taskcluster
import taskcluster.aio
import taskcluster_urls

from treeherder.etl.schema import get_json_schema
from treeherder.etl.taskcluster_pulse.parse_route import parseRoute

env = environ.Env()
logger = logging.getLogger(__name__)
projectsToIngest = env("PROJECTS_TO_INGEST", default=None)


# Build a mapping from exchange name to task status
EXCHANGE_EVENT_MAP = {
    "exchange/taskcluster-queue/v1/task-pending": "pending",
    "exchange/taskcluster-queue/v1/task-running": "running",
    "exchange/taskcluster-queue/v1/task-completed": "completed",
    "exchange/taskcluster-queue/v1/task-failed": "failed",
    "exchange/taskcluster-queue/v1/task-exception": "exception",
}


class PulseHandlerError(Exception):
    """Base error"""

    pass


def stateFromRun(jobRun):
    return "completed" if jobRun["state"] in ("exception", "failed") else jobRun["state"]


def resultFromRun(jobRun):
    RUN_TO_RESULT = {
        "completed": "success",
        "failed": "fail",
    }
    state = jobRun["state"]
    if state in list(RUN_TO_RESULT.keys()):
        return RUN_TO_RESULT[state]
    elif state == "exception":
        reasonResolved = jobRun.get("reasonResolved")
        if reasonResolved in ["canceled", "superseded"]:
            return reasonResolved
        return "exception"
    else:
        return "unknown"


# Creates a log entry for Treeherder to retrieve and parse.  This log is
# displayed on the Treeherder Log Viewer once parsed.
def createLogReference(root_url, taskId, runId):
    logUrl = taskcluster_urls.api(
        root_url, "queue", "v1", "task/{taskId}/runs/{runId}/artifacts/public/logs/live_backing.log"
    ).format(taskId=taskId, runId=runId)
    return {
        "name": "live_backing_log",
        "url": logUrl,
    }


# Filters the task routes for the treeherder specific route.  Once found,
# the route is parsed into distinct parts used for constructing the
# Treeherder job message.
# TODO: Refactor https://bugzilla.mozilla.org/show_bug.cgi?id=1560596
def parseRouteInfo(prefix, taskId, routes, task):
    matchingRoutes = list(filter(lambda route: route.split(".")[0] == "tc-treeherder", routes))

    if len(matchingRoutes) != 1:
        raise PulseHandlerError(
            "Could not determine Treeherder route. Either there is no route, "
            + "or more than one matching route exists."
            + "Task ID: {taskId} Routes: {routes}".format(taskId=taskId, routes=routes)
        )

    parsedRoute = parseRoute(matchingRoutes[0])

    return parsedRoute


def validateTask(task):
    treeherderMetadata = task.get("extra", {}).get("treeherder")
    if not treeherderMetadata:
        logger.debug("Task metadata is missing Treeherder job configuration.")
        return False
    try:
        jsonschema.validate(treeherderMetadata, get_json_schema("task-treeherder-config.yml"))
    except (jsonschema.ValidationError, jsonschema.SchemaError) as e:
        logger.error("JSON Schema validation error during Taskcluser message ingestion: %s", e)
        return False
    return True


def ignore_task(task, taskId, rootUrl, project):
    ignore = False
    # This logic is useful to reduce the number of tasks we ingest and requirying
    # less dynos and less database writes. You can adjust PROJECTS_TO_INGEST on the app to meet your needs
    if projectsToIngest and project not in projectsToIngest.split(","):
        logger.debug("Ignoring tasks not matching PROJECTS_TO_INGEST (Task id: %s)", taskId)
        return True

    mobile_repos = (
        "fenix",
        "firefox-android",
        "reference-browser",
        "mozilla-vpn-client",
        "mozilla-vpn-client-release",
    )
    if project in mobile_repos:
        envs = task["payload"].get("env", {})
        if envs.get("MOBILE_BASE_REPOSITORY"):
            try:
                base_repo = envs["MOBILE_BASE_REPOSITORY"].rsplit("/", 1)[1]
                if base_repo in mobile_repos:
                    # Ignore tasks that are associated to a pull request
                    if envs["MOBILE_BASE_REPOSITORY"] != envs["MOBILE_HEAD_REPOSITORY"]:
                        logger.debug(
                            "Task: %s belong to a pull request OR branch which we ignore.", taskId
                        )
                        ignore = True
                    # Bug 1587542 - Temporary change to ignore Github tasks not associated to 'master'
                    if envs["MOBILE_HEAD_REF"] not in (
                        "refs/heads/master",
                        "master",
                        "refs/heads/main",
                        "main",
                    ):
                        logger.info("Task: %s is not for the `master` branch.", taskId)
                        ignore = True
            except KeyError:
                pass
        else:
            # The decision task is the ultimate source for determining this information
            queue = taskcluster.Queue({"rootUrl": rootUrl})
            decision_task = queue.task(task["taskGroupId"])
            scopes = decision_task["metadata"].get("source")
            ignore = True
            for scope in scopes:
                # e.g. assume:repo:github.com/mozilla-mobile/fenix:branch:master
                if scope.find("branch:master") != -1 or scope.find("branch:main") != -1:
                    ignore = False
                    break

            # This handles nightly tasks
            # e.g. index.mobile.v2.fenix.branch.master.latest.taskgraph.decision-nightly
            for route in decision_task["routes"]:
                if route.find("master") != -1 or route.find("main") != -1:
                    ignore = False
                    break

    if ignore:
        logger.debug("Task to be ignored ({})".format(taskId))

    return ignore


# Listens for Task event messages and invokes the appropriate handler
# for the type of message received.
# Only messages that contain the properly formatted routing key and contains
# treeherder job information in task.extra.treeherder are accepted
# This will generate a list of messages that need to be ingested by Treeherder
async def handleMessage(message, taskDefinition=None):
    async with taskcluster.aio.createSession() as session:
        jobs = []
        taskId = message["payload"]["status"]["taskId"]
        asyncQueue = taskcluster.aio.Queue({"rootUrl": message["root_url"]}, session=session)
        task = (await asyncQueue.task(taskId)) if not taskDefinition else taskDefinition

        try:
            parsedRoute = parseRouteInfo("tc-treeherder", taskId, task["routes"], task)
        except PulseHandlerError as e:
            logger.debug("%s", str(e))
            return jobs

        if ignore_task(task, taskId, message["root_url"], parsedRoute["project"]):
            return jobs

        logger.debug("Message received for task %s", taskId)

        # Validation failures are common and logged, so do nothing more.
        if not validateTask(task):
            return jobs

        taskType = EXCHANGE_EVENT_MAP.get(message["exchange"])

        # Originally this code was only within the "pending" case, however, in order to support
        # ingesting all tasks at once which might not have "pending" case
        # If the job is an automatic rerun we mark the previous run as "retry"
        # This will only work if the previous run has not yet been processed by Treeherder
        # since _remove_existing_jobs() will prevent it
        if message["payload"]["runId"] > 0:
            jobs.append(await handleTaskRerun(parsedRoute, task, message, session))

        if not taskType:
            raise Exception("Unknown exchange: {exchange}".format(exchange=message["exchange"]))
        elif taskType == "pending":
            jobs.append(handleTaskPending(parsedRoute, task, message))
        elif taskType == "running":
            jobs.append(handleTaskRunning(parsedRoute, task, message))
        elif taskType in ("completed", "failed"):
            jobs.append(await handleTaskCompleted(parsedRoute, task, message, session))
        elif taskType == "exception":
            jobs.append(await handleTaskException(parsedRoute, task, message, session))

        return jobs


# Builds the basic Treeherder job message that's universal for all
# messsage types.
#
# Specific handlers for each message type will add/remove information necessary
# for the type of task event..
def buildMessage(pushInfo, task, runId, payload):
    taskId = payload["status"]["taskId"]
    jobRun = payload["status"]["runs"][runId]
    treeherderConfig = task["extra"]["treeherder"]

    job = {
        "buildSystem": "taskcluster",
        "owner": task["metadata"]["owner"],
        "taskId": "{taskId}/{runId}".format(taskId=slugid.decode(taskId), runId=runId),
        "retryId": runId,
        "isRetried": False,
        "display": {
            # jobSymbols could be an integer (i.e. Chunk ID) but need to be strings
            # for treeherder
            "jobSymbol": str(treeherderConfig["symbol"]),
            "groupSymbol": treeherderConfig.get("groupSymbol", "?"),
            # Maximum job name length is 140 chars...
            "jobName": task["metadata"]["name"][0:139],
        },
        "state": stateFromRun(jobRun),
        "result": resultFromRun(jobRun),
        "tier": treeherderConfig.get("tier", 1),
        "timeScheduled": task["created"],
        "jobKind": treeherderConfig.get("jobKind", "other"),
        "reason": treeherderConfig.get("reason", "scheduled"),
        "jobInfo": {
            "links": [],
            "summary": task["metadata"]["description"],
        },
        "version": 1,
    }

    job["origin"] = {
        "kind": pushInfo["origin"],
        "project": pushInfo["project"],
        "revision": pushInfo["revision"],
    }

    if pushInfo["origin"] == "hg.mozilla.org":
        job["origin"]["pushLogID"] = pushInfo["id"]
    else:
        job["origin"]["pullRequestID"] = pushInfo["id"]
        job["origin"]["owner"] = pushInfo["owner"]

    # Transform "collection" into an array of labels if task doesn't
    # define "labels".
    labels = treeherderConfig.get("labels", [])
    if not labels:
        if not treeherderConfig.get("collection"):
            labels = ["opt"]
        else:
            labels = list(treeherderConfig["collection"].keys())

    job["labels"] = labels

    machine = treeherderConfig.get("machine", {})
    job["buildMachine"] = {
        "name": jobRun.get("workerId", "unknown"),
        "platform": machine.get("platform", task["workerType"]),
        "os": machine.get("os", "-"),
        "architecture": machine.get("architecture", "-"),
    }

    if treeherderConfig.get("productName"):
        job["productName"] = treeherderConfig["productName"]

    if treeherderConfig.get("groupName"):
        job["display"]["groupName"] = treeherderConfig["groupName"]

    return job


def handleTaskPending(pushInfo, task, message):
    payload = message["payload"]
    return buildMessage(pushInfo, task, payload["runId"], payload)


async def handleTaskRerun(pushInfo, task, message, session):
    payload = message["payload"]
    job = buildMessage(pushInfo, task, payload["runId"] - 1, payload)
    job["state"] = "completed"
    job["result"] = "fail"
    job["isRetried"] = True
    # reruns often have no logs, so in the interest of not linking to a 404'ing artifact,
    # don't include a link
    job["logs"] = []
    job = await addArtifactUploadedLinks(
        message["root_url"], payload["status"]["taskId"], payload["runId"] - 1, job, session
    )
    return job


def handleTaskRunning(pushInfo, task, message):
    payload = message["payload"]
    job = buildMessage(pushInfo, task, payload["runId"], payload)
    job["timeStarted"] = payload["status"]["runs"][payload["runId"]]["started"]
    return job


async def handleTaskCompleted(pushInfo, task, message, session):
    payload = message["payload"]
    jobRun = payload["status"]["runs"][payload["runId"]]
    job = buildMessage(pushInfo, task, payload["runId"], payload)

    job["timeStarted"] = jobRun["started"]
    job["timeCompleted"] = jobRun["resolved"]
    job["logs"] = [
        createLogReference(message["root_url"], payload["status"]["taskId"], jobRun["runId"]),
    ]
    job = await addArtifactUploadedLinks(
        message["root_url"], payload["status"]["taskId"], payload["runId"], job, session
    )
    return job


async def handleTaskException(pushInfo, task, message, session):
    payload = message["payload"]
    jobRun = payload["status"]["runs"][payload["runId"]]
    # Do not report runs that were created as an exception.  Such cases
    # are deadline-exceeded
    if jobRun["reasonCreated"] == "exception":
        return

    job = buildMessage(pushInfo, task, payload["runId"], payload)
    # Jobs that get cancelled before running don't have a started time
    if jobRun.get("started"):
        job["timeStarted"] = jobRun["started"]
    job["timeCompleted"] = jobRun["resolved"]
    # exceptions generally have no logs, so in the interest of not linking to a 404'ing artifact,
    # don't include a link
    job["logs"] = []
    job = await addArtifactUploadedLinks(
        message["root_url"], payload["status"]["taskId"], payload["runId"], job, session
    )
    return job


async def fetchArtifacts(root_url, taskId, runId, session):
    asyncQueue = taskcluster.aio.Queue({"rootUrl": root_url}, session=session)
    res = await asyncQueue.listArtifacts(taskId, runId)
    artifacts = res["artifacts"]

    continuationToken = res.get("continuationToken")
    while continuationToken is not None:
        continuation = {"continuationToken": res["continuationToken"]}

        try:
            res = await asyncQueue.listArtifacts(taskId, runId, continuation)
        except Exception:
            break

        artifacts = artifacts.concat(res["artifacts"])
        continuationToken = res.get("continuationToken")

    return artifacts


# we no longer store these in the job_detail table, but we still need to
# fetch them in order to determine if there is an error_summary log;
# TODO refactor this when there is a way to only retrieve the error_summary
# artifact: https://bugzilla.mozilla.org/show_bug.cgi?id=1629716
async def addArtifactUploadedLinks(root_url, taskId, runId, job, session):
    artifacts = []
    try:
        artifacts = await fetchArtifacts(root_url, taskId, runId, session)
    except Exception:
        logger.debug("Artifacts could not be found for task: %s run: %s", taskId, runId)
        return job

    seen = {}
    links = []
    for artifact in artifacts:
        name = os.path.basename(artifact["name"])
        # Bug 1595902 - It seems that directories are showing up as artifacts; skip them
        if not name:
            continue
        if not seen.get(name):
            seen[name] = [artifact["name"]]
        else:
            seen[name].append(artifact["name"])
            name = "{name} ({length})".format(name=name, length=len(seen[name]) - 1)

        links.append(
            {
                "label": "artifact uploaded",
                "linkText": name,
                "url": taskcluster_urls.api(
                    root_url,
                    "queue",
                    "v1",
                    "task/{taskId}/runs/{runId}/artifacts/{artifact_name}".format(
                        taskId=taskId, runId=runId, artifact_name=artifact["name"]
                    ),
                ),
            }
        )

    job["jobInfo"]["links"] = links
    return job
