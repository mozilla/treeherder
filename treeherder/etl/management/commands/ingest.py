import asyncio
import inspect
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore

import aiohttp
import requests
import taskcluster
import taskcluster.aio
import taskcluster_urls as liburls
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from github.Commit import Commit

from treeherder.client.thclient import TreeherderClient
from treeherder.config.settings import GITHUB_TOKEN
from treeherder.etl.job_loader import JobLoader, MissingPushError
from treeherder.etl.push_loader import PushLoader
from treeherder.etl.pushlog import HgPushlogProcess, last_push_id_from_server
from treeherder.etl.taskcluster_pulse.handler import EXCHANGE_EVENT_MAP, handle_message
from treeherder.model.models import Repository
from treeherder.utils import github

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Executor to run threads in parallel
executor = ThreadPoolExecutor()

state_to_exchange = {}
for key, value in EXCHANGE_EVENT_MAP.items():
    state_to_exchange[value] = key

# Semaphore to limit the number of threads opening DB connections when processing jobs
conn_sem = BoundedSemaphore(50)


class Connection:
    def __enter__(self):
        conn_sem.acquire()

    def __exit__(self, exc_type, exc_val, exc_tb):
        connection.close()
        conn_sem.release()


def ingest_pr(pr_url, root_url):
    if not pr_url.ends_with("/"):
        pr_url += "/"
    _, _, _, org, repo, _, pull_number, _ = pr_url.split("/", 7)
    pulse = {
        "exchange": "exchange/taskcluster-github/v1/pull-request",
        "routingKey": f"primary.{org}.{repo}.synchronize",
        "payload": {
            "repository": repo,
            "organization": org,
            "action": "synchronize",
            "details": {
                "event.pullNumber": pull_number,
                "event.base.repo.url": f"https://github.com/{org}/{repo}.git",
                "event.head.repo.url": f"https://github.com/{org}/{repo}.git",
            },
        },
    }
    PushLoader().process(pulse["payload"], pulse["exchange"], root_url)


def ingest_hg_push(options):
    # get reference to repo and ingest this particular revision for this project
    project = options["project"]
    commit = options["commit"]

    if not options["last_n_pushes"] and not commit:
        raise CommandError("must specify --last-n-pushes or a positional commit argument")
    elif options["last_n_pushes"] and options["ingest_all_tasks"]:
        raise CommandError("Can't specify last_n_pushes and ingest_all_tasks at same time")
    elif options["last_n_pushes"] and options["commit"]:
        raise CommandError("Can't specify last_n_pushes and commit/revision at the same time")
    repo = Repository.objects.get(name=project, active_status="active")
    fetch_push_id = None

    if options["last_n_pushes"]:
        last_push_id = last_push_id_from_server(repo)
        fetch_push_id = max(1, last_push_id - options["last_n_pushes"])
        logger.info(
            "last server push id: %d; fetching push %d and newer",
            last_push_id,
            fetch_push_id,
        )
    elif options["ingest_all_tasks"]:
        gecko_decision_task = get_decision_task_id(project, commit, repo.tc_root_url)
        logger.info("## START ##")
        loop = asyncio.get_event_loop()
        loop.run_until_complete(process_tasks(gecko_decision_task, repo.tc_root_url))
        logger.info("## END ##")
    else:
        logger.info("You can ingest all tasks for a push with -a/--ingest-all-tasks.")

    _ingest_hg_push(project, commit, fetch_push_id)


def _ingest_hg_push(project, revision, fetch_push_id=None):
    # get reference to repo
    repo = Repository.objects.get(name=project, active_status="active")
    # get hg pushlog
    pushlog_url = f"{repo.url}/json-pushes/?full=1&version=2"
    # ingest this particular revision for this project
    process = HgPushlogProcess()
    # Use the actual push SHA, in case the changeset specified was a tag
    # or branch name (eg tip). HgPushlogProcess returns the full SHA.
    process.run(pushlog_url, project, changeset=revision, last_push_id=fetch_push_id)


async def ingest_task(task_id, root_url):
    # Limiting the connection pool just in case we have too many
    conn = aiohttp.TCPConnector(limit=10)
    # Remove default timeout limit of 5 minutes
    timeout = aiohttp.ClientTimeout(total=0)
    async with taskcluster.aio.createSession(connector=conn, timeout=timeout) as session:
        async_queue = taskcluster.aio.Queue({"rootUrl": root_url}, session=session)
        results = await asyncio.gather(async_queue.status(task_id), async_queue.task(task_id))
        await handle_task(
            {
                "status": results[0]["status"],
                "task": results[1],
            },
            root_url,
        )


async def handle_task(task, root_url):
    task_id = task["status"]["taskId"]
    runs = task["status"]["runs"]
    # If we iterate in order of the runs, we will not be able to mark older runs as
    # "retry" instead of exception
    for run in reversed(runs):
        message = {
            "exchange": state_to_exchange[run["state"]],
            "payload": {
                "status": {
                    "taskId": task_id,
                    "runs": runs,
                },
                "runId": run["runId"],
            },
            "root_url": root_url,
        }

        try:
            task_runs = await handle_message(message, task["task"])
        except Exception as e:
            logger.exception(e)

        if task_runs:
            # Schedule and run jobs inside the thread pool executor
            job_futures = [
                routine_to_future(process_job_with_threads, run, root_url) for run in task_runs
            ]
            await await_futures(job_futures)


async def fetch_group_tasks(task_group_id, root_url):
    tasks = []
    query = {}
    continuation_token = ""
    # Limiting the connection pool just in case we have too many
    conn = aiohttp.TCPConnector(limit=10)
    # Remove default timeout limit of 5 minutes
    timeout = aiohttp.ClientTimeout(total=0)
    async with taskcluster.aio.createSession(connector=conn, timeout=timeout) as session:
        async_queue = taskcluster.aio.Queue({"rootUrl": root_url}, session=session)
        while True:
            if continuation_token:
                query = {"continuationToken": continuation_token}
            response = await async_queue.listTaskGroup(task_group_id, query=query)
            tasks.extend(response["tasks"])
            continuation_token = response.get("continuationToken")
            if continuation_token is None:
                break
            logger.info("Requesting more tasks. %s tasks so far...", len(tasks))
        return tasks


async def process_tasks(task_group_id, root_url):
    try:
        tasks = await fetch_group_tasks(task_group_id, root_url)
        logger.info("We have %s tasks to process", len(tasks))
    except Exception as e:
        logger.exception(e)

    if not tasks:  # No tasks to process
        return

    # Schedule and run tasks inside the thread pool executor
    task_futures = [routine_to_future(handle_task, task, root_url) for task in tasks]
    await await_futures(task_futures)


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
    task_id = pulse_job.get("taskId", "unknown")
    logger.info("Loading into DB:\t%s", task_id)
    with Connection():
        try:
            JobLoader().process_job(pulse_job, root_url)
        except MissingPushError:
            logger.warning("The push was not in the DB. We are going to try that first")
            ingest_push(pulse_job["origin"]["project"], pulse_job["origin"]["revision"])
            JobLoader().process_job(pulse_job, root_url)


def find_task_id(index_path, root_url):
    index_url = liburls.api(root_url, "index", "v1", f"task/{index_path}")
    response = requests.get(index_url)
    if response.status_code == 404:
        raise Exception(f"Index URL {index_url} not found")
    return response.json()["taskId"]


def get_decision_task_id(project, revision, root_url):
    index_fmt = "gecko.v2.{}.revision.{}.taskgraph.decision"
    index_path = index_fmt.format(project, revision)
    return find_task_id(index_path, root_url)


def repo_meta(project):
    _repo = Repository.objects.filter(name=project)[0]
    assert _repo, f"The project {project} you specified is incorrect"
    split_url = _repo.url.split("/")
    return {
        "url": _repo.url,
        "branch": _repo.branches.exclude(branch__endswith="*")
        .values_list("branch", flat=True)
        .first()
        or "",
        "owner": split_url[3],
        "repo": split_url[4],
        "tc_root_url": _repo.tc_root_url,
    }


def query_data(repo_meta, commit):
    """Find the right event base sha to get the right list of commits

    This is not an issue in GithubPushTransformer because the PushEvent from Taskcluster
    already contains the data
    """
    # This is used for the `compare` API. The "event.base.sha" is only contained in Pulse events, thus,
    # we need to determine the correct value
    event_base_sha = repo_meta["branch"]
    # First we try and get a comparsion with `master`` neing the base sha
    comparison = github.get_comparison(
        owner=repo_meta["owner"], repo_name=repo_meta["repo"], base=event_base_sha, head=commit
    )
    merge_base_commit = comparison.merge_base_commit

    if merge_base_commit:
        committer_date = merge_base_commit.commit.committer.date

        # Since we don't use PushEvents that contain the "before" or "event.base.sha" fields [1]
        # we need to discover the right parent which existed in the base branch.
        # [1] https://github.com/taskcluster/taskcluster/blob/3dda0adf85619d18c5dcf255259f3e274d2be346/services/github/src/api.js#L55
        parents = merge_base_commit.parents
        if len(parents) == 1:
            parent = parents[0]
            parent_commit = github.get_commit(
                owner=repo_meta["owner"], repo=repo_meta["repo"], sha=parent.sha
            )
            parent_committer_date = parent_commit.commit.committer.date

            # All commits involvled in a PR share the same date
            if committer_date == parent_committer_date:
                # Recursively find the forking parent
                event_base_sha, _ = query_data(repo_meta, parent.sha)
            else:
                event_base_sha = parent.sha

        else:
            event_base_sha = None  # Initialize in case no suitable parent is found
            for parent in parents:
                temp_commit = github.get_commit(
                    owner=repo_meta["owner"], repo=repo_meta["repo"], sha=parent.sha
                )
                # All commits involved in a merge share the same committer's date
                if committer_date != temp_commit.commit.committer.date:
                    event_base_sha = temp_commit.sha
                    break
            if not event_base_sha:
                # Fallback if no specific parent is found with different committer date
                # This case might need more robust handling based on project-specific merge strategies
                event_base_sha = repo_meta[
                    "branch"
                ]  # default to branch if no specific parent found
        # This is to make sure that the value has changed
        if event_base_sha == repo_meta["branch"]:
            logger.warning("Event base SHA did not change from repo branch: %s", event_base_sha)
        else:
            logger.info("We have a new base: %s", event_base_sha)
            # When using the correct event_base_sha the "commits" field will be correct
            compare_result = github.get_comparison(
                repo_meta["owner"], repo_meta["repo"], event_base_sha, commit
            )
    else:
        # If no merge_base_commit, then the initial compare_result should be used
        # and event_base_sha remains the initial branch.
        event_base_sha = repo_meta["branch"]

    commits = []
    for temp_commit in compare_result.commits:
        commits.append(
            {
                "message": temp_commit.commit.message,
                "author": {
                    "name": temp_commit.commit.author.name,
                    "email": temp_commit.commit.author.email,
                    "date": temp_commit.commit.author.date,
                }
                if temp_commit.commit.author
                else None,
                "committer": {
                    "name": temp_commit.commit.committer.name,
                    "email": temp_commit.commit.committer.email,
                    "date": temp_commit.commit.committer.date,
                }
                if temp_commit.commit.committer
                else None,
                "id": temp_commit.sha,
            }
        )
    return event_base_sha, commits


def github_push_to_pulse(repo_meta, commit):
    event_base_sha, commits = query_data(repo_meta, commit)

    return {
        "exchange": "exchange/taskcluster-github/v1/push",
        "routingKey": "primary.{}.{}".format(repo_meta["owner"], repo_meta["repo"]),
        "payload": {
            "organization": repo_meta["owner"],
            "details": {
                "event.head.repo.url": "{}.git".format(repo_meta["url"]),
                "event.base.repo.branch": repo_meta["branch"],
                "event.base.sha": event_base_sha,
                "event.head.sha": commit,
            },
            "body": {
                "commits": commits,
            },
            "repository": repo_meta["repo"],
        },
    }


def ingest_push(project, revision, fetch_push_id=None):
    _repo = repo_meta(project)
    if _repo["url"].startswith("https://github.com"):
        pulse = github_push_to_pulse(_repo, revision)
        PushLoader().process(pulse["payload"], pulse["exchange"], _repo["tc_root_url"])
    else:
        _ingest_hg_push(project, revision)


def ingest_git_pushes(project, dry_run=False):
    """
    This method takes all commits for a repo from Github and determines which ones are considered
    part of a push or a merge. Treeherder groups commits by push.

    Once we determine which commits are considered the tip revision for a push/merge we then ingest it.

    Once we complete the ingestion we compare Treeherder's push API and compare if the pushes are sorted
    the same way as in Github.
    """
    if not GITHUB_TOKEN:
        raise Exception(
            "Set GITHUB_TOKEN env variable to avoid rate limiting - Visit https://github.com/settings/tokens."
        )

    logger.info("--> Converting Github commits to pushes")
    _repo = repo_meta(project)
    owner, repo = _repo["owner"], _repo["repo"]
    github_commits: list[Commit] = github.get_all_commits(owner, repo)
    not_push_revision = set()  # Use a set for faster lookups
    push_revision = []
    push_to_date = {}
    for commit in github_commits:
        # Get the entire commit object with all attributes
        detailed_commit_obj = github.get_commit(owner, repo, commit.sha)

        # Revisions that are marked as non-push should be ignored
        if commit.sha in not_push_revision:
            logger.debug(f"Not a revision of a push: {commit.sha}")
            continue

        # Establish which revisions to ignore
        # If a commit has multiple parents, treat only the first parent as push
        # All other parents are to be treated as merges and should not be treated as separate pushes
        if len(detailed_commit_obj.parents) > 1:
            for index, parent in enumerate(detailed_commit_obj.parents[1:]):
                not_push_revision.append(parent.sha)

        # The 1st parent is the push from `master` from which we forked
        if detailed_commit_obj.parents:
            oldest_parent_revision = detailed_commit_obj.parents[0].sha
            push_to_date = detailed_commit_obj.commit.committer.date.isoformat()
            logger.info(
                f"Push: {oldest_parent_revision} - Date: {push_to_date[oldest_parent_revision]}"
            )
        else:
            # Initial commit case
            oldest_parent_revision = detailed_commit_obj.sha
            push_to_date = detailed_commit_obj.commit.committer.date.isoformat()
            f"Initial Push: {oldest_parent_revision} - Date: {push_to_date[oldest_parent_revision]}"

        push_revision.append(commit["sha"])

    if not dry_run:
        logger.info("--> Ingest Github pushes")
        for revision in push_revision:
            ingest_push(project, revision)

    # Test that the *order* of the pushes is correct
    logger.info("--> Validating that the ingested pushes are in the right order")
    client = TreeherderClient(server_url="http://localhost:8000")
    th_pushes = client.get_pushes(project, count=len(push_revision))
    assert len(push_revision) == len(th_pushes)
    for index, revision in enumerate(push_revision):
        if revision != th_pushes[index]["revision"]:
            logger.warning("{} does not match {}".format(revision, th_pushes[index]["revision"]))


class Command(BaseCommand):
    """Management command to ingest data from a single push."""

    help = "Ingests a single push and tasks into Treeherder"

    def add_arguments(self, parser):
        parser.add_argument(
            "ingestion_type", nargs=1, help="Type of ingestion to do: [task|hg-push|git-commit|pr]"
        )
        parser.add_argument("-p", "--project", help="Hg repository to query (e.g. autoland)")
        parser.add_argument("-c", "--commit", "-r", "--revision", help="Commit/revision to import")
        parser.add_argument(
            "--enable-eager-celery",
            action="store_true",
            help="This will cause all Celery queues to execute (like log parsing). This will take way longer.",
        )
        parser.add_argument(
            "-a",
            "--ingest-all-tasks",
            action="store_true",
            help="This will cause all tasks associated to a commit to be ingested. This can take a long time.",
        )
        parser.add_argument(
            "--root-url",
            dest="root_url",
            default="https://firefox-ci-tc.services.mozilla.com",
            help="Taskcluster root URL for non-Firefox tasks (e.g. https://community-tc.services.mozilla.com",
        )
        parser.add_argument("--task-id", dest="taskId", nargs="?", help="taskId to ingest")
        parser.add_argument(
            "--pr-url",
            dest="prUrl",
            help="Ingest a PR: e.g. https://github.com/mozilla-mobile/android-components/pull/4821",
        )
        parser.add_argument(
            "--dry-run",
            dest="dryRun",
            action="store_true",
            help="Do not make changes to the database",
        )
        parser.add_argument(
            "--last-n-pushes", type=int, help="fetch the last N pushes from the repository"
        )

    def handle(self, *args, **options):
        loop = asyncio.get_event_loop()
        type_of_ingestion = options["ingestion_type"][0]
        root_url = options["root_url"]

        if not options["enable_eager_celery"]:
            logger.info("If you want all logs to be parsed use --enable-eager-celery")
        else:
            # Make sure all tasks are run synchronously / immediately
            settings.CELERY_TASK_ALWAYS_EAGER = True

        if type_of_ingestion == "task":
            assert options["taskId"]
            loop.run_until_complete(ingest_task(options["taskId"], root_url))
        elif type_of_ingestion == "pr":
            assert options["prUrl"]
            ingest_pr(options["prUrl"], root_url)
        elif type_of_ingestion.find("git") > -1:
            if not os.environ.get("GITHUB_TOKEN"):
                logger.warning(
                    "If you don't set up GITHUB_TOKEN you might hit Github's rate limiting. See docs for info."
                )
            if type_of_ingestion == "git-push":
                ingest_push(options["project"], options["commit"])
            elif type_of_ingestion == "git-pushes":
                ingest_git_pushes(options["project"], options["dryRun"])
        elif type_of_ingestion == "push":
            ingest_hg_push(options)
        else:
            raise Exception("Please check the code for valid ingestion types.")
