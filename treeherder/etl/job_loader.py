import logging
import time
from collections import defaultdict

import jsonschema
from dateutil import parser

from treeherder.etl.schema import job_json_schema
from treeherder.model.derived.jobs import JobsModel

logger = logging.getLogger(__name__)


class JobLoader:
    """Validate, transform and load a list of Jobs"""
    jobs_schema = None
    artifact_schema = None

    TEST_RESULT_MAP = {
        "success": "success",
        "fail": "testfailed",
        "exception": "exception",
        "canceled": "usercancel",
        "unknown": "unknown"
    }
    BUILD_RESULT_MAP = {
        "success": "success",
        "fail": "busted",
        "exception": "exception",
        "canceled": "usercancel",
        "unknown": "unknown"
    }

    def process_job_list(self, all_jobs_list, raise_errors=False):
        if not isinstance(all_jobs_list, list):
            all_jobs_list = [all_jobs_list]

        validated_jobs = self._get_validated_jobs_by_project(all_jobs_list)

        for project, job_list in validated_jobs.items():
            with JobsModel(project) as jobs_model:
                # todo: Continue using short revisions until Bug 1199364
                rs_lookup = jobs_model.get_revision_resultset_lookup(
                    [x["origin"]["revision"][:12] for x in job_list])
                storeable_job_list = []
                for pulse_job in job_list:
                    if pulse_job["state"] != "unscheduled":
                        try:
                            storeable_job_list.append(
                                self.transform(pulse_job, rs_lookup)
                            )
                        except AttributeError:
                            logger.warn("Skipping job due to bad attribute",
                                        exc_info=1)

                jobs_model.store_job_data(storeable_job_list,
                                          raise_errors=raise_errors)

    def transform(self, pulse_job, rs_lookup):
        """
        Transform a pulse job into a job that can be written to disk.  Log
        References and artifacts will also be transformed and loaded with the
        job.

        We can rely on the structure of ``pulse_job`` because it will
        already have been validated against the JSON Schema at this point.
        """
        return {
            # todo: Continue using short revisions until Bug 1199364
            "revision_hash": rs_lookup[pulse_job["origin"]["revision"][:12]]["revision_hash"],
            "job": {
                "job_guid": pulse_job["jobGuid"],
                "name": pulse_job["display"].get("jobName", "unknown"),
                "job_symbol": pulse_job["display"].get("jobSymbol"),
                "group_name": pulse_job["display"].get("groupName", "unknown"),
                "group_symbol": pulse_job["display"].get("groupSymbol"),
                "product_name": pulse_job.get("productName", "unknown"),
                "state": pulse_job["state"],
                "result": self._get_result(pulse_job),
                "reason": pulse_job.get("reason", "unknown"),
                "who": pulse_job.get("who", "unknown"),
                "tier": pulse_job.get("tier", 1),
                "submit_timestamp": self._to_timestamp(pulse_job["timeScheduled"]),
                "start_timestamp": self._to_timestamp(pulse_job["timeStarted"]),
                "end_timestamp": self._to_timestamp(pulse_job["timeCompleted"]),
                "machine": self._get_machine(pulse_job),
                "build_platform": self._get_platform(pulse_job.get("buildMachine", None)),
                "machine_platform": self._get_platform(pulse_job.get("runMachine", None)),
                "option_collection": self._get_option_collection(pulse_job),
                "log_references": self._get_log_references(pulse_job),
                "artifacts": self._get_artifacts(pulse_job),
            },
            "coalesced": pulse_job.get("coalesced", [])
        }

    def _get_artifacts(self, job):
        pulse_artifacts = job.get("artifacts", [])
        for artifact in pulse_artifacts:
            artifact["job_guid"] = job["jobGuid"]
        return pulse_artifacts

    def _get_log_references(self, job):
        log_references = []
        for logref in job.get("logs", []):
            log_references.append({
                "name": logref["name"],
                "url": logref["url"],
                "parse_status": logref.get("parseStatus", "pending")
            })
        return log_references

    def _get_option_collection(self, job):
        option_collection = {"opt": True}
        if "optionCollection" in job:
            option_collection = {}
            for option in job["optionCollection"]:
                option_collection[option] = True
        return option_collection

    def _get_platform(self, platform_src):
        platform = None
        if platform_src:
            platform = {
                "platform": platform_src["platform"],
                "os_name": platform_src["os"],
                "architecture": platform_src["architecture"]
            }
        return platform

    def _get_machine(self, job):
        machine = "unknown"
        if "buildMachine" in job:
            machine = job["buildMachine"]["name"]
        if "runMachine" in job:
            machine = job["runMachine"]["name"]
        return machine

    def _get_result(self, job):
        if job["state"] == "completed":
            resmap = self.BUILD_RESULT_MAP if job["jobKind"] == "build" else self.TEST_RESULT_MAP
            result = job.get("result", "unknown")
            if job.get("isRetried", False):
                return "retry"
            else:
                return resmap[result]
        return "unknown"

    def _get_validated_jobs_by_project(self, jobs_list):
        validated_jobs = defaultdict(list)
        for pulse_job in jobs_list:
            try:
                jsonschema.validate(pulse_job, job_json_schema)
                validated_jobs[pulse_job["origin"]["project"]].append(pulse_job)
            except (jsonschema.ValidationError, jsonschema.SchemaError) as e:
                logger.error(
                    "JSON Schema validation error during job ingestion: {}".format(e))

        return validated_jobs

    def _to_timestamp(self, datestr):
        return time.mktime(parser.parse(datestr).timetuple())
