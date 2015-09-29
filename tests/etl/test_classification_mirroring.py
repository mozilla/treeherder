import json
from time import time

from datadiff import diff

from treeherder.etl.classification_mirroring import ElasticsearchDocRequest
from treeherder.model.derived import ArtifactsModel


def test_elasticsearch_doc_request_body(test_project, eleven_jobs_stored):
    """
    Test the request body is created correctly
    """
    bug_id = 12345678
    job_id = 1
    sample_artifact = {
        "build_id": 39953854,
        "buildername": "b2g_emulator_vm mozilla-inbound opt test crashtest-2"
    }
    placeholders = [
        [job_id, "buildapi", "json",
         json.dumps(sample_artifact), job_id, "buildapi"]
    ]
    with ArtifactsModel(test_project) as artifacts_model:
        artifacts_model.store_job_artifact(placeholders)

    classification_timestamp = int(time())
    who = "user@mozilla.com"

    req = ElasticsearchDocRequest(test_project, job_id, bug_id, classification_timestamp, who)
    req.generate_request_body()

    expected = {
        "buildname": "b2g_emulator_vm mozilla-inbound opt test crashtest-2",
        "machinename": "bld-linux64-ec2-132",
        "os": "b2g-emu-jb",
        # I'm using the request time date here, as start time is not
        # available for pending jobs
        "date": "2013-11-13",
        "type": "B2G Emulator Image Build",
        "buildtype": "debug",
        "starttime": "1384353553",
        "tree": "test_treeherder",
        "rev": "cdfe03e77e66",
        "bug": str(bug_id),
        "who": who,
        "timestamp": str(classification_timestamp),
        "treeherder_job_id": job_id,
    }
    assert req.body == expected, diff(expected, req.body)
