from datetime import datetime
from treeherder.etl.tbpl import OrangeFactorBugRequest, BugzillaBugRequest
import json
from time import time
from datadiff import diff


def test_tbpl_bug_request_body(jm, eleven_jobs_processed):
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
         json.dumps(sample_artifact)]
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


def test_tbpl_bugzilla_request_body(jm, eleven_jobs_processed):
    """
    Test the request body is created correctly
    """

    bug_id = 12345678
    job = jm.get_job_list(0, 1)[0]

    submit_timestamp = int(time())
    submit_date = datetime.fromtimestamp(submit_timestamp).isoformat()
    who = "user@mozilla.com"
    jm.insert_bug_job_map(job['id'], bug_id, "manual", submit_timestamp, who)

    bug_suggestions = []
    bug_suggestions.append({"search": "First error line", "bugs": []})
    bug_suggestions.append({"search": "Second error line", "bugs": []})

    bug_suggestions_placeholders = [
        job['id'], 'Bug suggestions',
        'json', json.dumps(bug_suggestions)
    ]

    jm.store_job_artifact([bug_suggestions_placeholders])
    req = BugzillaBugRequest(jm.project, job["id"], bug_id)
    req.generate_request_body()

    expected = {
        'id': bug_id,
        'comment': (u'submit_timestamp: {0}\n'
                    u'log: http://local.treeherder.mozilla.org/ui/'
                    u'logviewer.html#?repo=test_treeherder&job_id=1\n'
                    u'repository: test_treeherder\n'
                    u'who: user[at]mozilla[dot]com\n'
                    u'machine: bld-linux64-ec2-132\n'
                    u'revision: cdfe03e77e66\n\n'
                    u'First error line\n'
                    u'Second error line').format(submit_date)
    }

    assert req.body == expected
