from treeherder.etl.tbpl import OrangeFactorBugRequest
import json
from time import time
from datadiff import diff


def test_get_request_body(jm, eleven_jobs_processed):
    """
    Test the request body is created correctly
    """

    bug_id = 12345678
    job = jm.get_job_list(0, 1)[0]
    sample_artifact = {
        "build_id": 39953854,
        "buildername": "b2g_emulator_vm mozilla-inbound opt test crashtest-2"
    }
    placeholders = [
        [job["id"], "buildapi", "json",
         json.dumps(sample_artifact), job["id"], "buildapi"]
    ]
    jm.store_job_artifact(placeholders)

    submit_timestamp = int(time())
    who = "user@mozilla.com"

    req = OrangeFactorBugRequest(jm.project, job["id"],
                         bug_id, submit_timestamp, who)
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
        "starttime": 1384353553,
        "logfile": "00000000",
        "tree": "test_treeherder",
        "rev": "cdfe03e77e66",
        "comment": "Bug {0}".format(bug_id),
        "who": who,
        "timestamp": submit_timestamp
    }

    assert req.body == expected, diff(expected, req.body)