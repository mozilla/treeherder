import logging
import time
from collections import defaultdict

import jsonschema
import newrelic.agent
from dateutil import parser

from treeherder.etl.schema import job_json_schema
from treeherder.model.derived.jobs import JobsModel

logger = logging.getLogger(__name__)


class JobLoader:
    """Validate, transform and load a list of Jobs"""

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
    TIME_FIELD_MAP = {
        "submit_timestamp": "timeScheduled",
        "start_timestamp": "timeStarted",
        "end_timestamp": "timeCompleted"
    }
    PLATFORM_FIELD_MAP = {
        "build_platform": "buildMachine",
        "machine_platform": "runMachine"
    }

    def process_job_list(self, all_jobs_list):
        if not isinstance(all_jobs_list, list):
            all_jobs_list = [all_jobs_list]

        validated_jobs = self._get_validated_jobs_by_project(all_jobs_list)

        for project, job_list in validated_jobs.items():
            with JobsModel(project) as jobs_model:
                storeable_job_list = []
                for pulse_job in job_list:
                    if pulse_job["state"] != "unscheduled":
                        try:
                            storeable_job_list.append(
                                self.transform(pulse_job)
                            )
                        except AttributeError:
                            logger.warn("Skipping job due to bad attribute",
                                        exc_info=1)

                jobs_model.store_job_data(storeable_job_list)

    def transform(self, pulse_job):
        """
        Transform a pulse job into a job that can be written to disk.  Log
        References and artifacts will also be transformed and loaded with the
        job.

        We can rely on the structure of ``pulse_job`` because it will
        already have been validated against the JSON Schema at this point.
        """
        job_guid = self._get_job_guid(pulse_job)
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
                "artifacts": self._get_artifacts(pulse_job, job_guid),
            },
            "coalesced": pulse_job.get("coalesced", [])
        }

        # It is possible there will be either a revision or a revision_hash
        # At some point we will ONLY get revisions and no longer receive
        # revision_hashes and then this check can be removed.
        revision = pulse_job["origin"].get("revision", None)
        if revision:
            x["revision"] = revision
        else:
            x["revision_hash"] = pulse_job["origin"]["revision_hash"]
            logger.warning(
                "Pulse job had revision_hash instead of revision: {}:{}".format(
                    pulse_job["origin"]["project"],
                    x["revision_hash"]
                ))
            params = {
                "project": pulse_job["origin"]["project"],
                "revision_hash": x["revision_hash"]
            }
            newrelic.agent.record_custom_event("revision_hash_usage", params=params)

        # some or all the time fields may not be present in some cases
        for k, v in self.TIME_FIELD_MAP.items():
            if v in pulse_job:
                x["job"][k] = self._to_timestamp(pulse_job[v])

        # if only one platform is given, use it.
        default_platform = pulse_job.get(
            "buildMachine",
            pulse_job.get("runMachine", {}))

        for k, v in self.PLATFORM_FIELD_MAP.items():
            platform_src = pulse_job[v] if v in pulse_job else default_platform
            x["job"][k] = self._get_platform(platform_src)

        return x

    def _get_job_guid(self, job):
        guid_parts = [job["taskId"]]
        retry_id = job.get("retryId", 0)
        if retry_id > 0:
            guid_parts.append(str(retry_id))
        return "/".join(guid_parts)

    def _get_job_symbol(self, job):
        return "{}{}".format(
            job["display"].get("jobSymbol", ""),
            job["display"].get("chunkId", "")
        )

    def _get_artifacts(self, job, job_guid):
        artifact_funcs = [self._get_job_info_artifact,
                          self._get_text_log_summary_artifact]
        pulse_artifacts = []
        for artifact_func in artifact_funcs:
            artifact = artifact_func(job, job_guid)
            if artifact:
                pulse_artifacts.append(artifact)

        # add in any arbitrary artifacts included in the "extra" section
        pulse_artifacts.extend(self._get_extra_artifacts(job, job_guid))
        return pulse_artifacts

    def _get_job_info_artifact(self, job, job_guid):
        if "jobInfo" in job:
            ji = job["jobInfo"]
            job_details = []
            if "summary" in ji:
                job_details.append({
                    "content_type": "raw_html",
                    "value": ji["summary"],
                    "title": "Summary"
                })
            if "links" in ji:
                for link in ji["links"]:
                    job_details.append({
                        "url": link["url"],
                        "content_type": "link",
                        "value": link["linkText"],
                        "title": link["label"]
                    })

            artifact = {
                "blob": {
                    "job_details": job_details
                },
                "type": "json",
                "name": "Job Info",
                "job_guid": job_guid
            }
            return artifact

    def _get_text_log_summary_artifact(self, job, job_guid):
        # We can only have one text_log_summary artifact,
        # so pick the first log with steps to create it.

        if "logs" in job:
            for log in job["logs"]:
                if "steps" in log:
                    all_errors = []
                    old_steps = log["steps"]
                    new_steps = []

                    for idx, step in enumerate(old_steps):
                        errors = step.get("errors", [])
                        error_count = len(errors)
                        if error_count:
                            all_errors.extend(errors)

                        started = self._to_timestamp(step["timeStarted"])
                        finished = self._to_timestamp(step["timeFinished"])
                        new_steps.append({
                            "name": step["name"],
                            "result": self._get_step_result(job, step["result"]),
                            "started": started,
                            "finished": finished,
                            "started_linenumber": step["lineStarted"],
                            "finished_linenumber": step["lineFinished"],
                            "errors": errors,
                            "error_count": error_count,
                            "duration": finished - started,
                            "order": idx
                        })

                    return {
                        "blob": {
                            "step_data": {
                                "all_errors": all_errors,
                                "steps": new_steps,
                                "errors_truncated": log.get("errorsTruncated")
                            },
                            "logurl": log["url"]
                        },
                        "type": "json",
                        "name": "text_log_summary",
                        "job_guid": job_guid
                    }

    def _get_extra_artifacts(self, job, job_guid):
        artifacts = []
        if "extra" in job and "artifacts" in job["extra"]:
            for extra_artifact in job["extra"]["artifacts"]:
                artifact = extra_artifact
                artifact["job_guid"] = job_guid
                artifacts.append(artifact)

        return artifacts

    def _get_log_references(self, job):
        log_references = []
        for logref in job.get("logs", []):
            log_references.append({
                "name": logref["name"],
                "url": logref["url"],
                "parse_status": "parsed" if "steps" in logref else "pending"
            })
        return log_references

    def _get_option_collection(self, job):
        option_collection = {"opt": True}
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
                "architecture": platform_src["architecture"]
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
