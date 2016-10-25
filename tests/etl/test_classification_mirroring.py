from time import time

from datadiff import diff

from treeherder.etl.classification_mirroring import ElasticsearchDocRequest


def test_elasticsearch_doc_request_body(test_project, eleven_jobs_stored):
    """
    Test the request body is created correctly
    """
    bug_id = 12345678
    job_id = 1

    classification_timestamp = int(time())
    who = "user@mozilla.com"

    req = ElasticsearchDocRequest(test_project, job_id, bug_id, classification_timestamp, who)
    req.generate_request_body()

    expected = {
        "buildname": "39643b5073cfb9473042884bfd3ced0289b3d7dd",
        "machinename": "bld-linux64-ec2-132",
        "os": "b2g-emu-jb",
        # I'm using the request time date here, as start time is not
        # available for pending jobs
        "date": "2013-11-13",
        "type": "B2G Emulator Image Build",
        "buildtype": "debug",
        "starttime": "1384353553",
        "tree": test_project,
        "rev": "45f8637cb9f78f19cb8463ff174e81756805d8cf",
        "bug": str(bug_id),
        "who": who,
        "timestamp": str(classification_timestamp),
        "treeherder_job_id": job_id,
    }
    assert req.body == expected, diff(expected, req.body)
