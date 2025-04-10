import datetime
import json

import pytz
import requests


def parse_build_platform(name, os_field="os_name"):
    platform = ""

    if name.startswith("test-"):
        name = name.replace("test-", "", 1)
    platform = name.split("/")[0]

    return {"platform": platform, os_field: "", "architecture": ""}


def fetch_url(url):
    try:
        response = requests.get(url, headers={"User-agent": "treeherder/1.0"}, timeout=10)
    except requests.exceptions.Timeout:
        print(f"timeout fetching {url}")
        raise
    return response


def get_tasks(project, revision):
    # 1) get push information, find results[0]["id"] <- this will be the push_id
    # https://treeherder.mozilla.org/api/project/autoland/push/?full=true&count=10&revision=473a353f2aeaaf904a08f7c1f287b5607d9e8cb9
    # 2) with push_id, get all tasks
    # https://treeherder.mozilla.org/api/jobs/?push_id=1587059

    retval = []

    response = fetch_url(
        f"https://treeherder.mozilla.org/api/project/{project}/push/?full=true&count=10&revision={revision}"
    )
    data = response.json()
    push_id = data["results"][0]["id"]

    response = fetch_url(f"https://treeherder.mozilla.org/api/jobs/?push_id={push_id}")
    data = response.json()

    # set a max of 100 tasks for a given revision, just so we don't have too much data
    for task in data["results"]:
        job_id = task[1]

        # https://treeherder.mozilla.org/api/project/autoland/jobs/495738649/
        response = fetch_url(f"https://treeherder.mozilla.org/api/project/{project}/jobs/{job_id}/")
        data = response.json()
        retval.append(data)
        if len(retval) >= 100:
            break

    return retval


def tasks_to_jobdata(all_tasks, project, revision):
    # get option collection hash to translate
    response = fetch_url("https://treeherder.mozilla.org/api/optioncollectionhash/")
    och = response.json()

    retval = []
    for task in all_tasks:
        build_platform = parse_build_platform(task["build_platform"])
        if not build_platform:
            # gecko-decision, lint, xyz-cross, a few others
            continue

        if not task["logs"]:
            # could be a failed task (infra, cancelled, retry, etc.)
            continue

        if not retval and not task["job_type_name"].startswith("test-"):
            # ensure we have a test task as the first in the list
            continue

        # only accept gtest, xpcshell, mochitest, reftest
        if task["job_type_name"].startswith("test-") and not any(
            [s in task["job_type_name"] for s in ["gtest", "xpcshell", "mochitest", "reftest"]]
        ):
            continue

        # only accept  (chunk 1) as well as other tasks
        if task["job_type_name"].startswith("test-"):
            try:
                if int(task["job_type_name"].split("-")[-1]) < 3:
                    continue
            except ValueError:
                pass

        results = {
            "project": "mozilla-central",  # project - hacked for testing purposes,
            "job": {
                "build_platform": parse_build_platform(task["build_platform"]),
                "submit_timestamp": task["submit_timestamp"],
                "start_timestamp": task["start_timestamp"],
                "job_guid": task["job_guid"],
                "name": task["job_type_name"],  # task["job_group_name"].split(" ")[0],
                "reference_data_name": task["ref_data_name"],
                "log_references": [
                    {"url": task["logs"][0]["url"], "name": task["logs"][0]["name"]}
                ],
                "option_collection": [
                    {x["options"][0]["name"]: True}
                    for x in och
                    if x["option_collection_hash"] == task["option_collection_hash"]
                ][0],
                "who": f"{task['machine_name'][:20]}@example.com",  # task["who"], <= protect the privacy of real developers
                "group_symbol": task["job_group_symbol"],
                "state": task["state"],
                "artifact": {"log_urls": [], "type": "", "name": "", "blob": ""},
                "machine_platform": parse_build_platform(task["job_type_name"]),
                "machine": task["machine_name"],
                "reason": task["reason"],
                "result": task["result"],
                "job_symbol": task["job_type_symbol"],
                "group_name": task["job_group_name"],
                "product_name": "firefox",  # hardcoded
                "end_timestamp": task["end_timestamp"],
            },
            "revision": revision,
        }
        retval.append(results)

    return retval


# get last 50 pushes, write raw data to 'output_file' and return list of revisions
def get_push_data(project, output_file):
    retval = []
    output = []

    # ideally autoland `hg log -50`
    # https://treeherder.mozilla.org/api/project/autoland/push/?full=true&count=50
    response = fetch_url(f"https://treeherder.mozilla.org/api/project/{project}/push/?count=50")
    data = response.json()

    for result in data["results"]:
        blob = {
            "id": result["id"],
            "revision": result["revision"],
            "author": result["author"],
            "revision_count": result["revision_count"],
            "push_timestamp": result["push_timestamp"],
            "repository_id": result["repository_id"],
            "revisions": [],
        }
        for r in result["revisions"]:
            blob["revisions"].append(
                {
                    "result_set_id": r["result_set_id"],
                    "repository_id": r["repository_id"],
                    "revision": r["revision"],
                    "author": "Fake Hacker <hacker1@example.com>",  # preserve identity: r["author"],
                    "comment": r["comments"],
                }
            )
        output.append(blob)

    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    for item in data["results"]:
        retval.append(item["revision"])

    return retval


def reduce_push_data(top_revision, output_file):
    with open(output_file) as f:
        data = json.load(f)

    startlen = len(data)
    output = []

    for item in data:
        if item["revision"] != top_revision and not output:
            continue
        item["author"] = f"hacker{len(output)}@example.com"
        for revision in item["revisions"]:
            revision["author"] = f"Hacker {len(output)} <hacker{len(output)}@example.com>"
        output.append(item)

    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Reduced push_data from {startlen} to {len(output)}")


def get_job_data(project, revisions, output_file):
    # do at least 3, and between 250 and 500 tasks
    jobdata = []
    total_tasks = 0
    revision_index = -1
    while total_tasks < 100:
        rev = revisions[revision_index]
        print(f"Getting data for revision: {rev} ...")
        all_tasks = get_tasks(project, rev)
        newjobs = tasks_to_jobdata(all_tasks, project, rev)
        total_tasks += len(newjobs)
        print(f"  found {len(newjobs)} tasks to add to job data!")
        if not newjobs:
            revision_index -= 3
            continue

        # hack, create similar jobs; ensure we have at least 4
        if jobdata:
            for field in [
                "build_platform",
                "name",
                "group_symbol",
                "machine_platform",
                "machine",
                "job_symbol",
                "group_name",
            ]:
                newjobs[0]["job"][field] = jobdata[0]["job"][field]
                newjobs[-1]["job"][field] = jobdata[0]["job"][field]
        jobdata.extend(newjobs)
        revision_index -= 3

    with open(output_file, "w") as f:
        for jd in jobdata:
            json.dump(jd, f)
            f.write("\n")
    return all_tasks, rev


def generate_pulse_job_data(tasks, revision, output_file):
    # get option collection hash to translate
    response = fetch_url("https://treeherder.mozilla.org/api/optioncollectionhash/")
    och = response.json()

    retval = []
    transformed = []
    max_tasks = 30

    for task in tasks:
        if not task["job_type_name"].startswith("test-"):
            continue
        if not parse_build_platform(task["build_platform"]):
            continue

        blob = {
            "taskId": task["job_guid"],
            "origin": {
                "kind": "hg.mozilla.org",
                "project": "set by test",
                "revision": revision,
            },
            "buildSystem": "taskcluster",
            "display": {
                "jobSymbol": task["job_type_symbol"],
                "jobName": task["job_type_name"],
                "groupSymbol": task["job_group_symbol"],
                "groupName": task["job_group_name"],
            },
            "state": task["state"],
            "result": "fail" if "fail" in task["result"] else task["result"],
            "jobKind": "test" if "test" in task["job_type_name"] else "build",
            "runMachine": parse_build_platform(task["job_type_name"], os_field="os"),
            "buildMachine": parse_build_platform(task["build_platform"], os_field="os"),
            "owner": f"{task['machine_name'][:20]}@example.com",  # task["who"], <= protect the privacy of real developers
            "reason": task["reason"],
            "productName": "Firefox",
            "labels": [
                x["options"][0]["name"]
                for x in och
                if x["option_collection_hash"] == task["option_collection_hash"]
            ],
            "version": 1,
            "logs": [log for log in task["logs"] if "live" in log["name"]],
            "jobInfo": {
                "links": [
                    {
                        "url": log["url"],
                        "linkText": log["name"],
                        "label": "artifact uploaded",
                    }
                    for log in task["logs"]
                    if "live" not in log["name"]
                ]
            },
        }
        blob["runMachine"]["name"] = task["machine_name"]
        blob["buildMachine"]["name"] = task["machine_name"]

        pst_tz = pytz.timezone("US/Pacific")
        offset = 0
        blob["timeScheduled"] = (
            datetime.datetime.fromtimestamp(task["submit_timestamp"] - offset)
            .replace(tzinfo=pytz.utc)
            .astimezone(pst_tz)
            .isoformat()
        )
        blob["timeStarted"] = (
            datetime.datetime.fromtimestamp(task["start_timestamp"] - offset)
            .replace(tzinfo=pytz.utc)
            .astimezone(pst_tz)
            .isoformat()
        )
        blob["timeCompleted"] = (
            datetime.datetime.fromtimestamp(task["end_timestamp"] - offset)
            .replace(tzinfo=pytz.utc)
            .astimezone(pst_tz)
            .isoformat()
        )

        offset = 8 * 3600
        job = {
            "taskcluster_task_id": task["task_id"],
            "taskcluster_retry_id": task["retry_id"],
            "build_platform": parse_build_platform(task["build_platform"]),
            "submit_timestamp": task["submit_timestamp"]
            - offset,  # subtract 8 hours to match pacific tz shift in job_data
            "start_timestamp": task["start_timestamp"]
            - offset,  # subtract 8 hours to match pacific tz shift in job_data
            "name": task["job_type_name"],
            "option_collection": [
                {x["options"][0]["name"]: True}
                for x in och
                if x["option_collection_hash"] == task["option_collection_hash"]
            ][0],
            "machine_platform": parse_build_platform(task["job_type_name"]),
            "build_system_type": task["build_system_type"],
            "who": f"{task['machine_name'][:20]}@example.com",  # task["who"], <= protect the privacy of real developers
            "group_symbol": task["job_group_symbol"],
            "reason": task["reason"],
            "group_name": task["job_group_name"],
            "machine": task["machine_name"],
            "state": task["state"],
            "result": task["result"],
            "log_references": [
                {"url": log["url"], "name": log["name"], "parse_status": "pending"}
                for log in task["logs"]
                if "live" in log["name"]
            ],  # TODO: parse_status?
            "tier": 1,  # task["tier"], <- treeherder transforms to tier1 by default for pulse task data
            "job_symbol": task["job_type_symbol"],
            "job_guid": task["job_guid"],
            "product_name": "Firefox",  # hardcoded
            "end_timestamp": task["end_timestamp"]
            - offset,  # subtract 8 hours to match pacific tz shift in job_data
        }
        transformed.append({"job": job, "revision": revision, "superseded": []})

        retval.append(blob)
        if len(retval) >= max_tasks:
            break

    with open(output_file, "w") as f:
        json.dump(retval, f, indent=2)

    transformed_file = output_file.replace("/job", "/transformed_job")
    with open(transformed_file, "w") as f:
        json.dump(transformed, f, indent=2)


project = "autoland"
revisions = get_push_data(project, output_file="push_data.json")
all_tasks, revision = get_job_data(project, revisions, output_file="job_data.txt")
generate_pulse_job_data(all_tasks, revision, output_file="pulse_consumer/job_data.json")
reduce_push_data(revision, output_file="push_data.json")

# TODO: ensure test at first entry
# TODO: ensure multiple job_type_id's to test similar jobs (could be other platforms, but ideally platforms as well as revisions)
