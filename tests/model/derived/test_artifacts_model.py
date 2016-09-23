from __future__ import unicode_literals

import json

import pytest

from treeherder.model.derived import (ArtifactsModel,
                                      JobsModel)
from treeherder.model.models import (JobDetail,
                                     TextLogError)

xfail = pytest.mark.xfail


def test_load_single_artifact(
        test_project, eleven_jobs_stored,
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

    def max_length(field):
        """Get the field's max_length for the JobDetail model"""
        return JobDetail._meta.get_field(field).max_length

    (long_title, long_value, long_url) = ('t' * (2 * max_length("title")),
                                          'v' * (2 * max_length("value")),
                                          'https://' + ('u' * (2 * max_length("url"))))
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
    assert jd.title == long_title[:max_length("title")]
    assert jd.value == long_value[:max_length("value")]
    assert jd.url == long_url[:max_length("url")]


def test_load_non_ascii_textlog_errors(test_project, eleven_jobs_stored):
    with JobsModel(test_project) as jobs_model:
        job = jobs_model.get_job_list(0, 1)[0]

    text_log_summary_artifact = {
        'type': 'json',
        'name': 'text_log_summary',
        'blob': json.dumps({
            'step_data': {
                "steps": [
                    {
                        'name': 'foo',
                        'started': '2016-05-10 12:44:23.103904',
                        'started_linenumber': 8,
                        'finished_linenumber': 10,
                        'finished': '2016-05-10 12:44:23.104394',
                        'result': 'success',
                        'errors': [
                            {
                                # non-ascii character
                                "line": '07:51:28  WARNING - \U000000c3'.encode('utf-8'),
                                "linenumber": 1587
                            },
                            {
                                # astral character (i.e. higher than ucs2)
                                "line": '07:51:29  WARNING - \U0001d400'.encode('utf-8'),
                                "linenumber": 1588
                            }
                        ]
                    }
                ]
            }
        }),
        'job_guid': job['job_guid']
    }
    with ArtifactsModel(test_project) as am:
        am.load_job_artifacts([text_log_summary_artifact])

    assert TextLogError.objects.count() == 2
    assert TextLogError.objects.get(line_number=1587).line == '07:51:28  WARNING - \U000000c3'
    assert TextLogError.objects.get(line_number=1588).line == '07:51:29  WARNING - <U+01D400>'
