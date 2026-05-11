import json
import logging

from treeherder.etl.artifact import serialize_artifact_json_blobs
from treeherder.etl.perf import store_performance_artifact
from treeherder.log_parser.utils import validate_perf_data
from treeherder.model.models import JobLog
from treeherder.utils.http import make_request

logger = logging.getLogger(__name__)
MAX_JSON_SIZE = 5 * 1024 * 1024


def post_perfherder_artifacts(job_log):
    logger.info("Downloading/storing performance data for artifact %s", job_log.id)

    try:
        with make_request(job_log.url, stream=False, timeout=60) as response:
            download_size_in_bytes = int(response.headers.get("Content-Length", -1))
            if download_size_in_bytes > 0 and download_size_in_bytes > MAX_JSON_SIZE:
                job_log.update_status(JobLog.SKIPPED_SIZE)
                logger.warning(
                    "Skipping perf json for %s: size %s bytes exceeds limit",
                    job_log.id,
                    download_size_in_bytes,
                )
                return
            raw = response.text

        data = json.loads(raw)
        if not data:
            logger.warning("Empty performance data for %s", job_log.id)
            return
        validate_perf_data(data)
        perf_list = [data]

        artifact = {"logurl": job_log.url, "performance_data": perf_list}
        artifact_list = [
            {
                "job_guid": job_log.job.guid,
                "name": "performance_data",
                "type": "json",
                "blob": json.dumps(artifact),
            }
        ]
    except Exception as e:
        job_log.update_status(JobLog.FAILED)
        logger.error("Failed to download/parse performance data for %s: %s", job_log.id, e)
        return

    try:
        serialized_artifacts = serialize_artifact_json_blobs(artifact_list)
        for artifact in serialized_artifacts:
            job_guid = artifact.get("job_guid")
            if not job_guid:
                logger.error(
                    "Failed to store performance data for %s: Artifact with no job guid set, skipping",
                    job_log.id,
                )
                continue

            store_performance_artifact(job_log.job, artifact)

        job_log.update_status(JobLog.PARSED)
        logger.info(
            "Stored performance data for %s %s %s",
            job_log.job.repository.name,
            job_log.job.id,
            job_log.id,
        )
    except Exception as e:
        logger.error("Failed to store performance data for %s: %s", job_log.id, e)
        raise
