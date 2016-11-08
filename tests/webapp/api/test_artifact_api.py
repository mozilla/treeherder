import json

import pytest

from treeherder.client.thclient import client
from treeherder.model.models import (TextLogError,
                                     TextLogStep)

xfail = pytest.mark.xfail


def test_artifact_create_text_log_summary(webapp, test_project, test_job,
                                          mock_post_json, sample_data):
    """
    test submitting a text_log_summary artifact creates some text log summary objects
    """
    tls = sample_data.text_log_summary

    # assert that we had no text log objects before this operation
    assert not TextLogStep.objects.filter(job=test_job).exists()

    tac = client.TreeherderArtifactCollection()
    ta = client.TreeherderArtifact({
        'type': 'json',
        'name': 'text_log_summary',
        'blob': json.dumps(tls['blob']),
        'job_guid': test_job.guid
    })
    tac.add(ta)

    cli = client.TreeherderClient(server_url='http://localhost')
    cli.post_collection(test_project, tac)

    # assert we generated some objects
    assert TextLogStep.objects.filter(job=test_job).count() > 0
    assert TextLogError.objects.filter(step__job=test_job).count() > 0
