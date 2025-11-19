# Code imported from https://github.com/taskcluster/taskcluster/blob/32629c562f8d6f5a6b608a3141a8ee2e0984619f/services/treeherder/src/handler.js
import logging
import os

import environ
import jsonschema
import slugid
import taskcluster
import taskcluster.aio
import taskcluster_urls
from django.conf import settings

from treeherder.etl.schema import get_json_schema
from treeherder.etl.taskcluster_pulse.parse_route import parse_route

env = environ.Env()
logger = logging.getLogger(__name__)
projects_to_ingest = env("PROJECTS_TO_INGEST", default=None)


# Build a mapping from exchange name to task status
EXCHANGE_EVENT_MAP = {
    "exchange/taskcluster-queue/v1/task-defined": "unscheduled",
    "exchange/taskcluster-queue/v1/task-pending": "pending",
    "exchange/taskcluster-queue/v1/task-running": "running",
    "exchange/taskcluster-queue/v1/task-completed": "completed",
    "exchange/taskcluster-queue/v1/task-failed": "failed",
    "exchange/taskcluster-queue/v1/task-exception": "exception",
}


class PulseHandlerError(Exception):
    """Base error"""

    pass


def state_from_run(job_run):
    return "completed" if job_run["state"] in ("exception", "failed") else job_run["state"]


def result_from_run(job_run):
    run_to_result = {
        "completed": "success",
        "failed": "fail",
    }
    state = job_run["state"]
    if state in list(run_to_result.keys()):
        return run_to_result[state]
    elif state == "exception":
        reason_resolved = job_run.get("reasonResolved")
        if reason_resolved in ["canceled", "superseded"]:
            return reason_resolved
        return "exception"
    else:
        return "unknown"


# Creates a log entry for Treeherder to retrieve and parse.  This log is
# displayed on the Treeherder Log Viewer once parsed.
def create_log_reference(root_url, task_id, run_id):
    log_url = taskcluster_urls.api(
        root_url, "queue", "v1", "task/{taskId}/runs/{runId}/artifacts/public/logs/live_backing.log"
    ).format(taskId=task_id, runId=run_id)
    return {
        "name": "live_backing_log",
        "url": log_url,
    }


# Filters the task routes for the treeherder specific route.  Once found,
# the route is parsed into distinct parts used for constructing the
# Treeherder job message.
# TODO: Refactor https://bugzilla.mozilla.org/show_bug.cgi?id=1560596
def parse_route_info(prefix, task_id, routes, task):
    matching_routes = list(filter(lambda route: route.split(".")[0] == "tc-treeherder", routes))

    if len(matching_routes) != 1:
        raise PulseHandlerError(
            "Could not determine Treeherder route. Either there is no route, "
            + "or more than one matching route exists."
            + f"Task ID: {task_id} Routes: {routes}"
        )

    parsed_route = parse_route(matching_routes[0])

    return parsed_route


def validate_task(task, task_id, run_id):
    treeherder_metadata = task.get("extra", {}).get("treeherder")
    if not treeherder_metadata:
        logger.debug(
            f"Task metadata is missing Treeherder job configuration for task {task_id}, run {run_id}"
        )
        return False
    try:
        jsonschema.validate(treeherder_metadata, get_json_schema("task-treeherder-config.yml"))
    except (jsonschema.ValidationError, jsonschema.SchemaError) as e:
        logger.error(
            f"JSON Schema validation error during Taskcluser message ingestion for task {task_id}, run {run_id}: {e}"
        )
        return False
    return True


def ignore_task(task, task_id, root_url, project):
    ignore = False
    # This logic is useful to reduce the number of tasks we ingest and requirying
    # less dynos and less database writes. You can adjust PROJECTS_TO_INGEST on the app to meet your needs
    if projects_to_ingest and project not in projects_to_ingest.split(","):
        logger.debug("Ignoring tasks not matching PROJECTS_TO_INGEST (Task id: %s)", task_id)
        return True

    mobile_repos = (
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
                            "Task: %s belong to a pull request OR branch which we ignore.", task_id
                        )
                        ignore = True
                    # Bug 1587542 - Temporary change to ignore Github tasks not associated to 'master'
                    if envs["MOBILE_HEAD_REF"] not in (
                        "refs/heads/master",
                        "master",
                        "refs/heads/main",
                        "main",
                    ):
                        logger.info("Task: %s is not for the `master` branch.", task_id)
                        ignore = True
            except KeyError:
                pass
        else:
            # The decision task is the ultimate source for determining this information
            queue = taskcluster.Queue({"rootUrl": root_url})
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
        logger.debug(f"Task to be ignored ({task_id})")

    return ignore


# Listens for Task event messages and invokes the appropriate handler
# for the type of message received.
# Only messages that contain the properly formatted routing key and contains
# treeherder job information in task.extra.treeherder are accepted
# This will generate a list of messages that need to be ingested by Treeherder
async def handle_message(message, task_definition=None):
    async with taskcluster.aio.createSession() as session:
        jobs = []
        task_id = message["payload"]["status"]["taskId"]
        run_id = message["payload"]["runId"]
        if task_definition:
            task = task_definition
        else:
            async_queue = taskcluster.aio.Queue({"rootUrl": message["root_url"]}, session=session)
            with settings.STATSD_CLIENT.timer("taskcluster_fetch_definition"):
                task = await async_queue.task(task_id)

        try:
            parsed_route = parse_route_info("tc-treeherder", task_id, task["routes"], task)
        except PulseHandlerError as e:
            logger.debug("%s", str(e))
            return jobs

        if ignore_task(task, task_id, message["root_url"], parsed_route["project"]):
            return jobs

        logger.debug("Message received for task %s", task_id)

        # Validation failures are common and logged, so do nothing more.
        if not validate_task(task, task_id, run_id):
            return jobs

        task_type = EXCHANGE_EVENT_MAP.get(message["exchange"])

        if not task_type:
            raise Exception("Unknown exchange: {exchange}".format(exchange=message["exchange"]))
        elif task_type == "pending":
            jobs.append(handle_task_pending(parsed_route, task, message))
        elif task_type == "running":
            jobs.append(handle_task_running(parsed_route, task, message))
        elif task_type in ("completed", "failed"):
            jobs.append(await handle_task_completed(parsed_route, task, message, session))
        elif task_type == "exception":
            jobs.append(await handle_task_exception(parsed_route, task, message, session))

        return jobs


# Builds the basic Treeherder job message that's universal for all
# messsage types.
#
# Specific handlers for each message type will add/remove information necessary
# for the type of task event..
def build_message(push_info, task, run_id, payload):
    task_id = payload["status"]["taskId"]
    job_run = payload["status"]["runs"][run_id]
    treeherder_config = task["extra"]["treeherder"]

    job = {
        "buildSystem": "taskcluster",
        "owner": task["metadata"]["owner"],
        "taskId": f"{slugid.decode(task_id)}/{run_id}",
        "retryId": run_id,
        "isRetried": False,
        "display": {
            # jobSymbols could be an integer (i.e. Chunk ID) but need to be strings
            # for treeherder
            "jobSymbol": str(treeherder_config["symbol"]),
            "groupSymbol": treeherder_config.get("groupSymbol", "?"),
            # Maximum job name length is 140 chars...
            "jobName": task["metadata"]["name"][0:139],
        },
        "state": state_from_run(job_run),
        "result": result_from_run(job_run),
        "tier": treeherder_config.get("tier", 1),
        "timeScheduled": task["created"],
        "jobKind": treeherder_config.get("jobKind", "other"),
        "reason": treeherder_config.get("reason", "scheduled"),
        "jobInfo": {
            "links": [],
            "summary": task["metadata"]["description"],
        },
        "version": 1,
    }

    job["origin"] = {
        "kind": push_info["origin"],
        "project": push_info["project"],
        "revision": push_info["revision"],
    }

    if push_info["origin"] == "hg.mozilla.org":
        job["origin"]["pushLogID"] = push_info["id"]
    else:
        job["origin"]["pullRequestID"] = push_info["id"]
        job["origin"]["owner"] = push_info["owner"]

    # Transform "collection" into an array of labels if task doesn't
    # define "labels".
    labels = treeherder_config.get("labels", [])
    if not labels:
        if not treeherder_config.get("collection"):
            labels = ["opt"]
        else:
            labels = list(treeherder_config["collection"].keys())

    job["labels"] = labels

    machine = treeherder_config.get("machine", {})
    job["buildMachine"] = {
        "name": job_run.get("workerId", "unknown"),
        "platform": machine.get("platform", task["workerType"]),
        "os": machine.get("os", "-"),
        "architecture": machine.get("architecture", "-"),
    }

    if treeherder_config.get("productName"):
        job["productName"] = treeherder_config["productName"]

    if treeherder_config.get("groupName"):
        job["display"]["groupName"] = treeherder_config["groupName"]

    return job


def handle_task_pending(push_info, task, message):
    payload = message["payload"]
    return build_message(push_info, task, payload["runId"], payload)


def handle_task_running(push_info, task, message):
    payload = message["payload"]
    job = build_message(push_info, task, payload["runId"], payload)
    job["timeStarted"] = payload["status"]["runs"][payload["runId"]]["started"]
    return job


async def handle_task_completed(push_info, task, message, session):
    payload = message["payload"]
    job_run = payload["status"]["runs"][payload["runId"]]
    job = build_message(push_info, task, payload["runId"], payload)

    job["timeStarted"] = job_run["started"]
    job["timeCompleted"] = job_run["resolved"]
    job["logs"] = [
        create_log_reference(message["root_url"], payload["status"]["taskId"], job_run["runId"]),
    ]
    job = await add_artifact_uploaded_links(
        message["root_url"], payload["status"]["taskId"], payload["runId"], job, session
    )
    return job


async def handle_task_exception(push_info, task, message, session):
    payload = message["payload"]
    runs = payload["status"]["runs"]
    run_id = payload["runId"]
    job_run = runs[run_id]
    # Do not report runs that were created as an exception.  Such cases
    # are deadline-exceeded
    if job_run["reasonCreated"] == "exception":
        return

    job = build_message(push_info, task, payload["runId"], payload)

    # Check if the next run was an automatic retry.
    if len(runs) > run_id + 1:
        next_run = runs[run_id + 1]
        job["isRetried"] = next_run["reasonCreated"] in ("retry", "task-retry")

    # Jobs that get cancelled before running don't have a started time
    if job_run.get("started"):
        job["timeStarted"] = job_run["started"]
    job["timeCompleted"] = job_run["resolved"]
    # exceptions generally have no logs, so in the interest of not linking to a 404'ing artifact,
    # don't include a link
    job["logs"] = []
    job = await add_artifact_uploaded_links(
        message["root_url"], payload["status"]["taskId"], run_id, job, session
    )
    return job


async def fetch_artifacts(root_url, task_id, run_id, session):
    async_queue = taskcluster.aio.Queue({"rootUrl": root_url}, session=session)
    res = await async_queue.listArtifacts(task_id, run_id)
    artifacts = res["artifacts"]

    continuation_token = res.get("continuationToken")
    while continuation_token is not None:
        continuation = {"continuationToken": res["continuationToken"]}

        try:
            res = await async_queue.listArtifacts(task_id, run_id, continuation)
        except Exception:
            break

        artifacts = artifacts.concat(res["artifacts"])
        continuation_token = res.get("continuationToken")

    return artifacts


# we no longer store these in the job_detail table, but we still need to
# fetch them in order to determine if there is an error_summary log;
# TODO refactor this when there is a way to only retrieve the error_summary
# artifact: https://bugzilla.mozilla.org/show_bug.cgi?id=1629716
async def add_artifact_uploaded_links(root_url, task_id, run_id, job, session):
    artifacts = []
    try:
        artifacts = await fetch_artifacts(root_url, task_id, run_id, session)
    except Exception:
        logger.debug("Artifacts could not be found for task: %s run: %s", task_id, run_id)
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
            name = f"{name} ({len(seen[name]) - 1})"

        links.append(
            {
                "label": "artifact uploaded",
                "linkText": name,
                "url": taskcluster_urls.api(
                    root_url,
                    "queue",
                    "v1",
                    "task/{taskId}/runs/{runId}/artifacts/{artifact_name}".format(
                        taskId=task_id, runId=run_id, artifact_name=artifact["name"]
                    ),
                ),
            }
        )

    job["jobInfo"]["links"] = links
    return job
