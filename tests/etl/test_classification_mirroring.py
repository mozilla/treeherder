import json
from time import time

from datadiff import diff
from django.conf import settings
from treeherder.etl.classification_mirroring import ElasticsearchDocRequest, BugzillaCommentRequest
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


def test_bugzilla_comment_request_body(test_project, eleven_jobs_stored):
    """
    Test the request body is created correctly
    """
    bug_id = 12345678
    job_id = 1
    who = "user@mozilla.com"

    bug_suggestions = []
    bug_suggestions.append({"search": "First error line", "search_terms": [], "bugs": []})
    bug_suggestions.append({"search": "Second error line", "search_terms": [], "bugs": []})

    bug_suggestions_placeholders = [
        job_id, 'Bug suggestions',
        'json', json.dumps(bug_suggestions),
        job_id, 'Bug suggestions',
    ]

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts_model.store_job_artifact([bug_suggestions_placeholders])

    req = BugzillaCommentRequest(test_project, job_id, bug_id, who)
    req.generate_request_body()

    expected = {
        'comment': (u'log: http://local.treeherder.mozilla.org/'
                    u'logviewer.html#?repo=test_treeherder&job_id=1\n'
                    u'repository: test_treeherder\n'
                    u'start_time: 2013-11-13T06:39:13\n'
                    u'who: user[at]mozilla[dot]com\n'
                    u'machine: bld-linux64-ec2-132\n'
                    u'buildname: non-buildbot b2g-emu-jb test B2G Emulator Image Build\n'
                    u'revision: cdfe03e77e66\n\n'
                    u'First error line\n'
                    u'Second error line')
    }
    assert req.body == expected


def test_bugzilla_comment_length_capped(test_project, eleven_jobs_stored):
    """
    Test that the total number of characters in the comment is capped correctly.
    """
    bug_id = 12345678
    job_id = 1
    who = "user@mozilla.com"

    # Create an error line with length equal to the max comment length.
    # Once the job metadata has been added, the total comment length
    # will exceed the max length, unless correctly truncated.
    bug_suggestions = [{"search": "a" * settings.BZ_MAX_COMMENT_LENGTH,
                        "search_terms": [],
                        "bugs": []
                        }]

    bug_suggestions_placeholders = [
        job_id, 'Bug suggestions',
        'json', json.dumps(bug_suggestions),
        job_id, 'Bug suggestions',
    ]

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts_model.store_job_artifact([bug_suggestions_placeholders])
    req = BugzillaCommentRequest(test_project, job_id, bug_id, who)
    req.generate_request_body()

    assert len(req.body['comment']) == settings.BZ_MAX_COMMENT_LENGTH
