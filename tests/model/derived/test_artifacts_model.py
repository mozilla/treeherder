import json

import pytest

from treeherder.model.derived import (ArtifactsModel,
                                      JobsModel)
from treeherder.model.models import JobDetail

xfail = pytest.mark.xfail


def test_load_single_artifact(
        test_project, eleven_jobs_stored,
        mock_post_json, mock_error_summary,
        sample_data):
    """
    test loading a single artifact

    """

    with JobsModel(test_project) as jobs_model:
        job = jobs_model.get_job_list(0, 1)[0]
    bs_blob = ["flim", "flam"]

    bs_artifact = {
        'type': 'json',
        'name': 'Bug suggestions',
        'blob': json.dumps(bs_blob),
        'job_guid': job['job_guid']
    }

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job["id"])}
        })

    assert len(artifacts) == 1
    artifact_names = {x['name'] for x in artifacts}
    act_bs_obj = [x['blob'] for x in artifacts if x['name'] == 'Bug suggestions'][0]

    assert set(artifact_names) == {'Bug suggestions'}
    assert bs_blob == act_bs_obj


def test_load_artifact_second_time_fails(
        test_project, eleven_jobs_stored,
        mock_post_json, mock_error_summary,
        sample_data):
    """
    test loading two of the same named artifact only gets the first one

    """

    with JobsModel(test_project) as jobs_model:
        job = jobs_model.get_job_list(0, 1)[0]
    bs_blob = ["flim", "flam"]

    bs_artifact1 = {
        'type': 'json',
        'name': 'Bug suggestions',
        'blob': json.dumps(bs_blob),
        'job_guid': job['job_guid']
    }
    bs_artifact2 = {
        'type': 'json',
        'name': 'Bug suggestions',
        'blob': json.dumps(["me", "you"]),
        'job_guid': job['job_guid']
    }

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact1])
        artifacts_model.load_job_artifacts([bs_artifact2])

        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job["id"])}
        })

    assert len(artifacts) == 1
    artifact_names = {x['name'] for x in artifacts}
    act_bs_obj = [x['blob'] for x in artifacts
                  if x['name'] == 'Bug suggestions'][0]

    assert set(artifact_names) == {'Bug suggestions'}
    assert bs_blob == act_bs_obj


def test_load_long_job_details(test_project, eleven_jobs_stored):
    # job details should still load even if excessively long,
    # they'll just be truncated
    with JobsModel(test_project) as jobs_model:
        job = jobs_model.get_job_list(0, 1)[0]

    max_field_lengths = JobDetail.MAX_FIELD_LENGTHS

    (long_title, long_value, long_url) = ('t' * (2 * max_field_lengths["title"]),
                                          'v' * (2 * max_field_lengths["value"]),
                                          'https://' + ('u' * (2 * max_field_lengths["url"])))
    ji_artifact = {
        'type': 'json',
        'name': 'Job Info',
        'blob': json.dumps({
            'job_details': [{
                'title': long_title,
                'value': long_value,
                'url': long_url
            }]
        }),
        'job_guid': job['job_guid']
    }
    with ArtifactsModel(test_project) as am:
        am.load_job_artifacts([ji_artifact])

    assert JobDetail.objects.count() == 1

    jd = JobDetail.objects.all()[0]
    assert jd.title == long_title[:max_field_lengths["title"]]
    assert jd.value == long_value[:max_field_lengths["value"]]
    assert jd.url == long_url[:max_field_lengths["url"]]
