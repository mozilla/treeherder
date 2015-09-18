import logging
import jsonschema
import json
import time
from dateutil import parser
from collections import defaultdict

from kombu import Queue
from kombu.mixins import ConsumerMixin

from treeherder.model.derived.jobs import JobsModel
from treeherder.etl.schema import IngestionDataSchema

logger = logging.getLogger(__name__)


class JobConsumer(ConsumerMixin):
    """
    Consume jobs from Pulse exchanges
    """
    def __init__(self, connection):
        self.connection = connection
        self.consumers = []
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel("DEBUG")
        self.job_loader = JobLoader()

    def get_consumers(self, Consumer, channel):
        return [
            Consumer(**c) for c in self.consumers
        ]

    def listen_to(self, exchange, routing_key, queue_name, durable=False):
        self.logger.info("Pulse message consumer listening to : {} {}".format(
            exchange.name,
            routing_key
        ))

        queue = Queue(
            name=queue_name,
            channel=self.connection.channel(),
            exchange=exchange,
            routing_key=routing_key,
            durable=durable,
            auto_delete=True
        )

        self.consumers.append(dict(queues=queue, callbacks=[self.on_message]))

    def on_message(self, body, message):
        logger.info("Job received via Pulse")

        try:
            jobs = json.loads(body)
            self.job_loader.process_job_list(jobs)
            message.ack()

        except Exception:
            logger.error("Unable to load jobs: {}".format(message), exc_info=1)

    def close(self):
        super(JobConsumer, self).close()
        self.job_loader.disconnect()


class JobLoader:
    """
    Validate, transform and load a list of Jobs

    """
    jobs_schema = None
    artifact_schema = None

    # status can only transition from lower to higher order.  If a job comes
    # in to update a status to a lower order, it will be skipped as out of
    # sequence.
    STATUS_RANK = {
        "unscheduled": 0,
        "pending": 1,
        "running": 2,
        "success": 3,
        "fail": 3,
        "exception": 3,
        "canceled": 3
    }
    COMPLETED_STATUS_RANK = 3
    TEST_RESULT_MAP = {
        "success": "success",
        "fail": "testfailed",
        "exception": "exception",
        "canceled": "usercancel"
    }
    BUILD_RESULT_MAP = {
        "success": "success",
        "fail": "busted",
        "exception": "exception",
        "canceled": "usercancel"
    }

    def __init__(self):
        self.jobs_schema = IngestionDataSchema().job_json_schema
        self.jobs_models = {}

    def get_jobs_model(self, project):
        if project not in self.jobs_models:
            logger.info("<><> creating new model for {}".format(self.jobs_models))
            self.jobs_models[project] = JobsModel(project)

        return self.jobs_models[project]

    def disconnect(self):
        for jm in self.jobs_models.values():
            logger.info("Disconnecting model: {}".format(jm.project))
            jm.disconnect()

    def process_job_list(self, all_jobs_list, raise_errors=False):
        if not isinstance(all_jobs_list, list):
            all_jobs_list = [all_jobs_list]

        validated_jobs = self._get_validated_jobs_by_project(all_jobs_list)

        for project, job_list in validated_jobs.items():
            jobs_model = self.get_jobs_model(project)
            rs_lookup = jobs_model.get_revision_resultset_lookup(
                [x["origin"]["revision"] for x in job_list])
            storeable_job_list = []
            for pulse_job in job_list:
                if pulse_job["status"] != "unscheduled":
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
            "revision_hash": rs_lookup[pulse_job["origin"]["revision"]]["revision_hash"],
            "job": {
                "job_guid": pulse_job["jobGuid"],
                "name": pulse_job["display"].get("jobName", "unknown"),
                "job_symbol": pulse_job["display"].get("jobSymbol"),
                "group_name": pulse_job["display"].get("groupName", "unknown"),
                "group_symbol": pulse_job["display"].get("groupSymbol"),
                "product_name": pulse_job.get("productName", "unknown"),
                "state": self._get_state(pulse_job),
                "result": self._get_result(pulse_job),
                "reason": pulse_job["reason"],
                "who": pulse_job["who"],
                "tier": pulse_job.get("tier", 1),
                "submit_timestamp": self._to_timestamp(pulse_job["timeScheduled"]),
                "start_timestamp": self._to_timestamp(pulse_job["timeStarted"]),
                "end_timestamp": self._to_timestamp(pulse_job["timeCompleted"]),
                "machine": self._get_machine(pulse_job),
                "build_platform": self._get_platform(pulse_job["machine"].get("build", None)),
                "machine_platform": self._get_platform(pulse_job["machine"].get("test", None)),
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
                "os_name": platform_src["osName"],
                "architecture": platform_src["architecture"]
            }
        return platform

    def _get_machine(self, job):
        machine = "unknown"
        if "build" in job["machine"]:
            machine = job["machine"]["build"]["machineName"]
        if "run" in job["machine"]:
            machine = job["machine"]["run"]["machineName"]
        return machine

    def _get_state(self, job):
        status = job["status"]
        state = "completed"
        if status in ["pending", "running"]:
            state = status
        elif status == "unscheduled":
            raise AttributeError("unscheduled not a supported status at this time.")
        return state

    def _get_result(self, job):
        result = "unknown"
        status = job["status"]
        if self.STATUS_RANK[status] >= self.COMPLETED_STATUS_RANK:
            if job.get("isRetried", False):
                result = "retry"
            elif job["jobKind"] == "build":
                result = self.BUILD_RESULT_MAP[status]
            else:
                result = self.TEST_RESULT_MAP[status]
        return result

    def _get_validated_jobs_by_project(self, jobs_list):
        validated_jobs = defaultdict(list)
        for pulse_job in jobs_list:
            try:
                jsonschema.validate(pulse_job, self.jobs_schema)
                validated_jobs[pulse_job["origin"]["project"]].append(pulse_job)
            except (jsonschema.ValidationError, jsonschema.SchemaError) as e:
                logger.error(
                    "JSON Schema validation error during job ingestion: {}".format(e))

        return validated_jobs

    def _to_timestamp(self, datestr):
        return time.mktime(parser.parse(datestr).timetuple())
