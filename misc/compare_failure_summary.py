#!/usr/bin/env python
"""Compare the classic Failure Summary data against the *_testsummary.jsonl artifact.

For every completed job in a push, this fetches:
- the `path_end` test paths from the `bug_suggestions` endpoint (what the
  log-parser/TextLogError pipeline considers failing, shown in the Failure
  Summary tab), and
- the tests with an unexpected final result from the job's `*_testsummary.jsonl`
  Taskcluster artifact (what the new Summary tab renders),

then reports, per job, which test paths only show up in one of the two.

This is useful while the Summary tab is being rolled out, to spot jobs/pushes
where the two views of "what failed" disagree.
"""

import argparse
import json
import logging

import requests
from thclient import TreeherderClient

logging.basicConfig()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

HOSTS = {
    "localhost": "http://localhost:8000",
    "stage": "https://treeherder.allizom.org",
    "production": "https://treeherder.mozilla.org",
}

SUMMARY_ARTIFACT_SUFFIX = "_testsummary.jsonl"
REQUEST_TIMEOUT = 30


def get_bug_suggestion_tests(client, project, job_id):
    """Test paths (`path_end`) the classic pipeline flagged as failing for this job."""
    url = f"{client.server_url}/api/project/{project}/jobs/{job_id}/bug_suggestions/"
    resp = client.session.get(url, timeout=client.timeout)
    resp.raise_for_status()
    return {suggestion["path_end"] for suggestion in resp.json() if suggestion.get("path_end")}


def find_testsummary_artifact_url(tc_root_url, task_id, run_id):
    """URL of the job's `*_testsummary.jsonl` artifact, or None if it has none."""
    list_url = f"{tc_root_url}/api/queue/v1/task/{task_id}/runs/{run_id}/artifacts"
    resp = requests.get(list_url, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    for artifact in resp.json().get("artifacts", []):
        if artifact["name"].endswith(SUMMARY_ARTIFACT_SUFFIX):
            return f"{list_url}/{artifact['name']}"
    return None


def get_unexpected_tests(artifact_url):
    """Test names whose last (post-retry) result in the jsonl artifact was unexpected.

    Mirrors the grouping logic in ui/helpers/testSummary.js: a test can be logged
    more than once when retried, and only the last result decides pass/fail.
    """
    resp = requests.get(artifact_url, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()

    success_by_test = {}
    for line in resp.text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except ValueError:
            continue

        if event.get("action") == "test_result" and event.get("test"):
            test = event["test"]
            success = "expected" not in event
        elif event.get("action") == "crash":
            test = event.get("test") or event.get("signature") or "(unknown test)"
            success = False
        else:
            continue

        # Later lines for the same test overwrite earlier ones, so this ends
        # up holding only the last (retried) result per test.
        success_by_test[test] = success

    return {test for test, success in success_by_test.items() if not success}


def compare_job(client, project, tc_root_url, job):
    """Compare one job's failure-summary tests against its testsummary.jsonl tests.

    Returns "match", "mismatch", or None if there was nothing to compare
    (e.g. no testsummary artifact for this job).
    """
    job_id = job["id"]
    task_id = job.get("task_id")
    label = f"{job['job_type_name']} (job {job_id}, task {task_id})"

    try:
        fs_tests = get_bug_suggestion_tests(client, project, job_id)
    except requests.HTTPError as e:
        logger.debug("%s: failed to fetch bug_suggestions: %s", label, e)
        return None

    if not job.get("task_id") or job.get("retry_id") is None:
        if fs_tests:
            logger.debug("%s: no taskcluster metadata, can't check for the artifact", label)
        return None

    try:
        artifact_url = find_testsummary_artifact_url(tc_root_url, job["task_id"], job["retry_id"])
    except requests.HTTPError as e:
        logger.debug("%s: failed to list taskcluster artifacts: %s", label, e)
        return None

    if not artifact_url:
        if fs_tests:
            logger.debug(
                "%s: %d failure-summary test(s), but no %s artifact",
                label,
                len(fs_tests),
                SUMMARY_ARTIFACT_SUFFIX,
            )
        return None

    try:
        ts_tests = get_unexpected_tests(artifact_url)
    except requests.HTTPError as e:
        logger.debug("%s: failed to fetch %s: %s", label, SUMMARY_ARTIFACT_SUFFIX, e)
        return None

    only_fs = fs_tests - ts_tests
    only_ts = ts_tests - fs_tests

    if not only_fs and not only_ts:
        return "match"

    logger.info("%s: MISMATCH", label)
    if only_fs:
        logger.info("  only in Failure Summary (%d): %s", len(only_fs), sorted(only_fs))
    if only_ts:
        logger.info("  only in Test Summary (%d): %s", len(only_ts), sorted(only_ts))
    return "mismatch"


def resolve_push_id(client, project, revision):
    """Push id for the push whose tip revision is `revision`."""
    pushes = client.get_pushes(project, revision=revision)
    if not pushes:
        raise SystemExit(f"No push with revision {revision} on {project}")
    return pushes[0]["id"]


def main(args):
    client = TreeherderClient(server_url=HOSTS[args.host])

    repositories = {repo["name"]: repo for repo in client.get_repositories()}
    repository = repositories.get(args.project)
    if not repository:
        raise SystemExit(f"Unknown project: {args.project}")
    tc_root_url = repository["tc_root_url"]

    push_id = args.push_id or resolve_push_id(client, args.project, args.revision)

    jobs = client.get_jobs(args.project, push_id=push_id, state="completed", count=None)
    logger.info("Comparing %d completed job(s) for push %s on %s", len(jobs), push_id, args.project)

    outcomes = {"match": 0, "mismatch": 0, "skipped": 0}
    for job in jobs:
        outcome = compare_job(client, args.project, tc_root_url, job)
        outcomes[outcome or "skipped"] += 1

    logger.info(
        "Done: %d match, %d mismatch, %d skipped (no testsummary artifact/metadata)",
        outcomes["match"],
        outcomes["mismatch"],
        outcomes["skipped"],
    )


def get_args():
    parser = argparse.ArgumentParser(
        description=(
            "Compare classic Failure Summary data against *_testsummary.jsonl "
            "artifacts for every job in a push."
        )
    )
    parser.add_argument(
        "--host", default="production", choices=HOSTS, help="Treeherder instance to query"
    )
    parser.add_argument("--project", required=True, help="Repository name, e.g. autoland")
    push_group = parser.add_mutually_exclusive_group(required=True)
    push_group.add_argument("--push-id", type=int, help="Treeherder push id")
    push_group.add_argument("--revision", help="Push (tip) revision hash")

    return parser.parse_args()


if __name__ == "__main__":
    main(get_args())
