import logging
import os
import yaml
import jsonschema
import time
from dateutil import parser
from collections import defaultdict

from kombu import Queue
from kombu.mixins import ConsumerMixin

from treeherder.model.derived.jobs import JobsModel

logger = logging.getLogger(__name__)

######
# This will use the store_job_data method in jobs.  I will likely end up that
# it is more efficient to circumvent that at some point.  But for now, this
# ensures we're following the same path as the rest of the ingestion code.
#
######


class JobConsumer(ConsumerMixin):

    def __init__(self, connection):
        self.connection = connection
        self.consumers = []
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel("DEBUG")

    def get_consumers(self, Consumer, channel):
        return [
            Consumer(**c) for c in self.consumers
        ]

    def listen_to(self, exchange, routing_key, queue_name, callback):
        self.logger.info("Pulse message consumer listening to : {} {}".format(
            exchange.name,
            routing_key
        ))

        queue = Queue(
            name=queue_name,
            channel=self.connection.channel(),
            exchange=exchange,
            routing_key=routing_key,
            durable=False,
            auto_delete=True
        )

        self.consumers.append(dict(queues=queue, callbacks=[callback]))


class JobLoader:
    jobs_schema = None
    artifact_schema = None

    # status can only transition from lower to higher order.  If a job comes
    # in to update a status to a lower order, it will be skipped as out of
    # sequence.
    status_rank = {
        "unscheduled": 0,
        "pending": 1,
        "running": 2,
        "success": 3,
        "fail": 3,
        "exception": 3,
        "canceled": 3
    }
    completed_status_rank = 3
    test_result_map = {
        "success": "success",
        "fail": "testfail",
        "exception": "exception",
        "canceled": "usercancel"
    }
    build_result_map = {
        "success": "success",
        "fail": "busted",
        "exception": "exception",
        "canceled": "usercancel"
    }

    @staticmethod
    def get_jobs_schema():
        with open("{0}/schemas/job.yml".format(
                  os.path.dirname(__file__))) as f:
            return yaml.load(f)

    def __init__(self):
        self.jobs_schema = self.get_jobs_schema()

    def process_job_list(self, all_jobs_list, raise_errors=False):
        validated_jobs = self._get_validated_jobs_by_project(all_jobs_list)

        for project, job_list in validated_jobs.items():
            print "project: " + project
            with JobsModel(project) as jobs_model:
                rs_lookup = jobs_model.get_revision_resultset_lookup(
                    [x["origin"]["revision"] for x in job_list])
                storeable_job_list = []
                for pulse_job in job_list:
                    if pulse_job["status"] != "unscheduled":
                        try:
                            storeable_job_list.append(self.transform(pulse_job, rs_lookup))
                        except AttributeError:
                            logger.warn("Skipping job due to bad attribute", exc_info=1)

                import pprint
                pprint.pprint(storeable_job_list)
                jobs_model.store_job_data(storeable_job_list, raise_errors=raise_errors)

    def transform(self, pulse_job, rs_lookup):
        """
        Transform a pulse job into a job that can be written to disk.

        Also generate log references and artifacts
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
                "state": self.get_state(pulse_job),
                "result": self.get_result(pulse_job),
                "reason": pulse_job["reason"],
                "who": pulse_job["who"],
                "submit_timestamp": self.to_timestamp(pulse_job["timeScheduled"]),
                "start_timestamp": self.to_timestamp(pulse_job["timeStarted"]),
                "end_timestamp": self.to_timestamp(pulse_job["timeCompleted"]),
                "machine": self.get_machine(pulse_job),
                "build_platform": self.get_platform(pulse_job["machine"].get("build", None)),
                "machine_platform": self.get_platform(pulse_job["machine"].get("test", None)),
                "option_collection": self.get_option_collection(pulse_job),
                "log_references": self.get_log_references(pulse_job),
                "artifacts": self.get_artifacts(pulse_job),
            },
            "coalesced": pulse_job.get("coalesced", [])
        }

    def get_artifacts(self, job):
        pulse_artifacts = job["artifacts"]
        for artifact in pulse_artifacts:
            artifact["job_guid"] = job["jobGuid"]
        return pulse_artifacts

    def get_log_references(self, job):
        log_references = []
        for logref in job["logs"]:
            log_references.append({
                "name": logref["name"],
                "url": logref["url"],
                "parse_status": logref.get("parseStatus", "pending")
            })
        return log_references

    @staticmethod
    def get_option_collection(job):
        option_collection = {"opt": True}
        if "optionCollection" in job:
            option_collection = {}
            for option in job["optionCollection"]:
                option_collection[option] = True
        return option_collection

    @staticmethod
    def get_platform(platform_src):
        platform = None
        if platform_src:
            platform = {
                "platform": platform_src["platform"],
                "os_name": platform_src["osName"],
                "architecture": platform_src["architecture"]
            }
        return platform

    @staticmethod
    def get_machine(job):
        machine = "unknown"
        if "build" in job["machine"]:
            machine = job["machine"]["build"]["machineName"]
        if "run" in job["machine"]:
            machine = job["machine"]["run"]["machineName"]
        return machine

    @staticmethod
    def get_state(job):
        status = job["status"]
        state = "completed"
        if status in ["pending", "running"]:
            state = status
        elif status == "unscheduled":
            raise AttributeError("unscheduled not a supported status at this time.")
        return state

    def get_result(self, job):
        result = "unknown"
        status = job["status"]
        if self.status_rank[status] >= self.completed_status_rank:
            if job.get("isRetried", False):
                result = "retry"
            elif job["jobKind"] == "build":
                result = self.build_result_map[status]
            else:
                result = self.test_result_map[status]

        return result

    def _get_validated_jobs_by_project(self, jobs_list):
        validated_jobs = defaultdict(list)
        for pulse_job in jobs_list:
            try:
                jsonschema.validate(pulse_job, self.jobs_schema)
                validated_jobs[pulse_job["origin"]["project"]].append(pulse_job)
            except (jsonschema.ValidationError, jsonschema.SchemaError) as e:
                logger.error("JSON Schema validation error during job ingestion: {}".format(e))

        return validated_jobs

    @staticmethod
    def to_timestamp(datestr):
        return time.mktime(parser.parse(datestr).timetuple())
