""" Script to compare two pushes from different Treeherder instances"""
import logging
import pprint
import uuid

import slugid

from deepdiff import DeepDiff
from thclient import TreeherderClient

logging.basicConfig()
logger = logging.getLogger(__name__).setLevel(logging.DEBUG)


def remove_some_attributes(job, remote_job):
    # I belive these differences are expected since they are dependant to when the data
    # was inserted inside of the database
    del job["build_platform_id"]
    del job["id"]
    del job["job_group_id"]
    del job["job_type_id"]
    del job["last_modified"]
    del job["push_id"]
    del job["result_set_id"]
    del remote_job["build_platform_id"]
    del remote_job["id"]
    del remote_job["job_group_id"]
    del remote_job["job_type_id"]
    del remote_job["last_modified"]
    del remote_job["push_id"]
    del remote_job["result_set_id"]

    if job.get("end_timestamp"):
        del job["end_timestamp"]
        del job["start_timestamp"]
        del remote_job["end_timestamp"]
        del remote_job["start_timestamp"]

    if job.get("failure_classification_id"):
        del job["failure_classification_id"]
        del remote_job["failure_classification_id"]


def print_url_to_taskcluster(job_guid):
    job_guid = job["job_guid"]
    (decoded_task_id, retry_id) = job_guid.split("/")
    # As of slugid v2, slugid.encode() returns a string not bytestring under Python 3.
    taskId = slugid.encode(uuid.UUID(decoded_task_id))
    print("https://taskcluster-ui.herokuapp.com/tasks/{}".format(taskId))


if __name__ == "__main__":
    # XXX: This script should take arguments instead being hardcoded
    # http://localhost:5000/#/jobs?repo=mozilla-central&revision=eb7f4d56f54b3283fc15983ee859b5e62fcb9f3b
    local = TreeherderClient(server_url="http://localhost:8000")
    local_jobs = local.get_jobs("mozilla-central", push_id=8717, count=None)

    # https://treeherder.mozilla.org/#/jobs?repo=mozilla-central&revision=eb7f4d56f54b3283fc15983ee859b5e62fcb9f3b
    remote = TreeherderClient("https://treeherder.mozilla.org")
    remote_jobs = remote.get_jobs("mozilla-central", push_id=516192, count=None)

    remote_dict = {}
    for job in remote_jobs:
        remote_dict[job["job_guid"]] = job

    local_dict = {}
    local_not_found = []
    for job in local_jobs:
        remote_job = remote_dict.get(job["job_guid"])
        if remote_job is None:
            local_not_found.append(job)
        else:
            # You can use this value in a url with &selectedJob=
            jobId = job["id"]
            remove_some_attributes(job, remote_job)

            differences = DeepDiff(job, remote_dict[job["job_guid"]])
            if differences:
                pprint.pprint(differences)
                print(jobId)
            else:
                # Delete jobs that don"t have any differences
                del remote_dict[job["job_guid"]]

    print("We have found: {} jobs on the local instance.".format(len(local_jobs)))
    print("We have found: {} jobs on the remote instance.".format(len(remote_jobs)))

    if remote_dict:
        print("There are the first 10 remote jobs we do not have locally. Follow the link to investigate.")
        for job in list(remote_dict.values())[0:10]:
            print_url_to_taskcluster(job["job_guid"])

    if local_not_found:
        print("Number of jobs not found locally: {} jobs".format(len(local_not_found)))
        for job in local_not_found:
            print_url_to_taskcluster(job["job_guid"])

    if remote_dict is None and local_not_found is None:
        print("We have not found any differences between the two pushes!! :D")
