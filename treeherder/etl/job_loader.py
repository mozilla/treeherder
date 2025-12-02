import logging
import uuid

import jsonschema
import slugid
from django.conf import settings

from treeherder.etl.common import to_timestamp
from treeherder.etl.exceptions import MissingPushError
from treeherder.etl.jobs import store_job_data
from treeherder.etl.schema import get_json_schema
from treeherder.etl.taskcluster_pulse.handler import ignore_task
from treeherder.model.models import Push, Repository
from treeherder.utils.taskcluster import get_task_definition

logger = logging.getLogger(__name__)


# TODO: Improve the code https://bugzilla.mozilla.org/show_bug.cgi?id=1560596
# add some taskcluster metadata if it's available
# currently taskcluster doesn't pass the taskId directly, so we'll
# derive it from the guid, where it is stored in uncompressed
# guid form of a slug (see: https://github.com/taskcluster/slugid)
# FIXME: add support for processing the taskcluster information
# properly, when it's available:
# https://bugzilla.mozilla.org/show_bug.cgi?id=1323110#c7
def task_and_retry_ids(job_guid):
    (decoded_task_id, retry_id) = job_guid.split("/")
    # As of slugid v2, slugid.encode() returns a string not bytestring under Python 3.
    real_task_id = slugid.encode(uuid.UUID(decoded_task_id))
    return (real_task_id, retry_id)


class JobLoader:
    """Validate, transform and load a list of Jobs"""

    TEST_RESULT_MAP = {
        "success": "success",
        "fail": "testfailed",
        "exception": "exception",
        "retry": "retry",
        "canceled": "usercancel",
        "superseded": "superseded",
        "unknown": "unknown",
    }
    BUILD_RESULT_MAP = {
        "success": "success",
        "fail": "busted",
        "exception": "exception",
        "retry": "retry",
        "canceled": "usercancel",
        "superseded": "superseded",
        "unknown": "unknown",
    }
    TIME_FIELD_MAP = {
        "submit_timestamp": "timeScheduled",
        "start_timestamp": "timeStarted",
        "end_timestamp": "timeCompleted",
    }
    PLATFORM_FIELD_MAP = {"build_platform": "buildMachine", "machine_platform": "runMachine"}

    def process_job(self, pulse_job, root_url):
        with settings.STATSD_CLIENT.timer("process_job_validate"):
            is_valid = self._is_valid_job(pulse_job)
        if is_valid:
            try:
                with settings.STATSD_CLIENT.timer("process_job_transform"):
                    project = pulse_job["origin"]["project"]

                    repository = Repository.objects.get(name=project)
                    if repository.active_status != "active":
                        (real_task_id, _) = task_and_retry_ids(pulse_job["taskId"])
                        logger.debug(
                            "Task %s belongs to a repository that is not active.", real_task_id
                        )
                        return

                    transformed_job = None
                    if pulse_job["state"] != "unscheduled":
                        try:
                            self.validate_revision(repository, pulse_job)
                            transformed_job = self.transform(pulse_job)
                        except AttributeError:
                            logger.warning("Skipping job due to bad attribute", exc_info=1)

                if transformed_job:
                    with settings.STATSD_CLIENT.timer("process_job_store"):
                        store_job_data(repository, [transformed_job])
                        # Returning the transformed_job is only for testing purposes
                        return transformed_job
            except Repository.DoesNotExist:
                logger.info("Job with unsupported project: %s", project)

    def validate_revision(self, repository, pulse_job):
        revision = pulse_job["origin"].get("revision")
        # will raise an exception if repository with name does not
        # exist (which we want, I think, to draw attention to the problem)
        # check the revision for this job has an existing push
        # If it doesn't, then except out so that the celery task will
        # retry till it DOES exist.
        revision_field = "revision__startswith" if len(revision) < 40 else "revision"
        filter_kwargs = {"repository": repository, revision_field: revision}

        if not Push.objects.filter(**filter_kwargs).exists():
            (real_task_id, _) = task_and_retry_ids(pulse_job["taskId"])
            project = pulse_job["origin"]["project"]
            repository = Repository.objects.get(name=project)
            task = get_task_definition(repository.tc_root_url, real_task_id)
            # We do this to prevent raising an exception for a task that will never be ingested
            if not ignore_task(task, real_task_id, repository.tc_root_url, project):
                raise MissingPushError(
                    "No push found in {} for revision {} for task {}".format(
                        pulse_job["origin"]["project"], revision, real_task_id
                    )
                )

    def transform(self, pulse_job):
        """
        Transform a pulse job into a job that can be written to disk.  Log
        References and artifacts will also be transformed and loaded with the
        job.

        We can rely on the structure of ``pulse_job`` because it will
        already have been validated against the JSON Schema at this point.
        """
        job_guid = pulse_job["taskId"]

        x = {
            "job": {
                "job_guid": job_guid,
                "name": pulse_job["display"].get("jobName", "unknown"),
                "job_symbol": self._get_job_symbol(pulse_job),
                "group_name": pulse_job["display"].get("groupName", "unknown"),
                "group_symbol": pulse_job["display"].get("groupSymbol"),
                "product_name": pulse_job.get("productName", "unknown"),
                "state": pulse_job["state"],
                "result": self._get_result(pulse_job),
                "reason": pulse_job.get("reason", "unknown"),
                "who": pulse_job.get("owner", "unknown"),
                "build_system_type": pulse_job["buildSystem"],
                "tier": pulse_job.get("tier", 1),
                "machine": self._get_machine(pulse_job),
                "option_collection": self._get_option_collection(pulse_job),
                "log_references": self._get_log_references(pulse_job),
                "perfherder_data_references": self._get_perfherder_data_references(pulse_job),
            },
            "superseded": pulse_job.get("coalesced", []),
            "revision": pulse_job["origin"]["revision"],
        }

        # some or all the time fields may not be present in some cases
        for k, v in self.TIME_FIELD_MAP.items():
            if v in pulse_job:
                x["job"][k] = to_timestamp(pulse_job[v])

        # if only one platform is given, use it.
        default_platform = pulse_job.get("buildMachine", pulse_job.get("runMachine", {}))

        for k, v in self.PLATFORM_FIELD_MAP.items():
            platform_src = pulse_job[v] if v in pulse_job else default_platform
            x["job"][k] = self._get_platform(platform_src)

        try:
            (real_task_id, retry_id) = task_and_retry_ids(job_guid)
            x["job"].update(
                {"taskcluster_task_id": real_task_id, "taskcluster_retry_id": int(retry_id)}
            )
        # TODO: Figure out what exception types we actually expect here.
        except Exception:
            pass

        return x

    def _get_job_symbol(self, job):
        return "{}{}".format(job["display"].get("jobSymbol", ""), job["display"].get("chunkId", ""))

    def _get_log_references(self, job):
        log_references = []
        for logref in job.get("logs", []):
            log_references.append(
                {"name": logref["name"], "url": logref["url"], "parse_status": "pending"}
            )
        log_references.extend(self._get_errorsummary_log_references(job))
        return log_references

    def _get_perfherder_data_references(self, job):
        performance_data_references = []
        for artifact in job.get("jobInfo", {}).get("links", []):
            artifact_link = artifact.get("url")
            if (
                artifact_link
                and "perfherder-data" in artifact_link
                and artifact_link.endswith(".json")
            ):
                performance_data_references.append(
                    {
                        "name": artifact.get("linkText"),
                        "url": artifact_link,
                        "parse_status": "pending",
                    }
                )

        return performance_data_references

    def _get_errorsummary_log_references(self, job):
        log_references = []
        try:
            links = job["jobInfo"]["links"]
        except KeyError:
            return []
        for link in links:
            text = link.get("linkText", "")
            if "url" in link and text.endswith("_errorsummary.log"):
                log_references.append(
                    {"name": "errorsummary_json", "url": link["url"], "parse_status": "pending"}
                )
        return log_references

    def _get_option_collection(self, job):
        option_collection = {}
        if "labels" in job:
            option_collection = {}
            for option in job["labels"]:
                option_collection[option] = True
        return option_collection

    def _get_platform(self, platform_src):
        platform = {}
        if platform_src:
            platform = {
                "platform": platform_src["platform"],
                "os_name": platform_src["os"],
                "architecture": platform_src["architecture"],
            }
        return platform

    def _get_machine(self, job):
        machine = "unknown"
        if "buildMachine" in job:
            machine = job["buildMachine"].get("name", machine)
        elif "runMachine" in job:
            machine = job["runMachine"].get("name", machine)
        return machine

    def _get_result(self, job):
        if job["state"] == "completed":
            resmap = self.TEST_RESULT_MAP if job["jobKind"] == "test" else self.BUILD_RESULT_MAP
            result = job.get("result", "unknown")
            if job.get("isRetried", False):
                return "retry"
            return resmap[result]
        return "unknown"

    def _get_step_result(self, job, result):
        resmap = self.TEST_RESULT_MAP if job["jobKind"] == "test" else self.BUILD_RESULT_MAP
        return resmap[result]

    def _is_valid_job(self, pulse_job):
        if pulse_job is None:
            return False
        try:
            # e.g. mozilla-l10n-automation-bot@users.noreply.github.com
            # Changing the pulse schema will also require a schema change
            if len(pulse_job["owner"]) > 50:
                pulse_job["owner"] = pulse_job["owner"][0:49]
            jsonschema.validate(pulse_job, get_json_schema("pulse-job.yml"))
        except (jsonschema.ValidationError, jsonschema.SchemaError) as e:
            if "taskId" in pulse_job:
                (real_task_id, run_id) = task_and_retry_ids(pulse_job["taskId"])
            else:
                real_task_id = "unknown"
                run_id = "unknown"
            logger.error(
                f"JSON Schema validation error during job ingestion for task {real_task_id}, run {run_id}: {e}"
            )
            return False
        return True
