import json

import pytest

from treeherder.model.derived import (ArtifactsModel,
                                      JobsModel)

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
