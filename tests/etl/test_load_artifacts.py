import json

from treeherder.etl.artifact import store_job_artifacts
from treeherder.model.models import JobDetail, TextLogError, TextLogStep


def test_load_long_job_details(test_job):
    def max_length(field):
        """Get the field's max_length for the JobDetail model"""
        return JobDetail._meta.get_field(field).max_length

    (long_title, long_value, long_url) = (
        't' * (2 * max_length("title")),
        'v' * (2 * max_length("value")),
        'https://' + ('u' * (2 * max_length("url"))),
    )
    ji_artifact = {
        'type': 'json',
        'name': 'Job Info',
        'blob': json.dumps(
            {'job_details': [{'title': long_title, 'value': long_value, 'url': long_url}]}
        ),
        'job_guid': test_job.guid,
    }
    store_job_artifacts([ji_artifact])

    assert JobDetail.objects.count() == 1

    jd = JobDetail.objects.first()
    assert jd.title == long_title[: max_length("title")]
    assert jd.value == long_value[: max_length("value")]
    assert jd.url == long_url[: max_length("url")]


def test_load_textlog_summary_twice(test_repository, test_job):
    text_log_summary_artifact = {
        'type': 'json',
        'name': 'text_log_summary',
        'blob': json.dumps(
            {
                'step_data': {
                    "steps": [
                        {
                            'name': 'foo',
                            'started': '2016-05-10 12:44:23.103904',
                            'started_linenumber': 8,
                            'finished_linenumber': 10,
                            'finished': '2016-05-10 12:44:23.104394',
                            'result': 'success',
                            'errors': [{"line": '07:51:28  WARNING - foobar', "linenumber": 1587}],
                        }
                    ]
                }
            }
        ),
        'job_guid': test_job.guid,
    }

    store_job_artifacts([text_log_summary_artifact])
    assert TextLogError.objects.count() == 1
    assert TextLogStep.objects.count() == 1
    # load again (simulating the job being parsed twice,
    # which sometimes happens)
    store_job_artifacts([text_log_summary_artifact])
    assert TextLogError.objects.count() == 1
    assert TextLogStep.objects.count() == 1


def test_load_non_ascii_textlog_errors(test_job):
    text_log_summary_artifact = {
        'type': 'json',
        'name': 'text_log_summary',
        'blob': json.dumps(
            {
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
                                    "line": '07:51:28  WARNING - \U000000c3',
                                    "linenumber": 1587,
                                },
                                {
                                    # astral character (i.e. higher than ucs2)
                                    "line": '07:51:29  WARNING - \U0001d400',
                                    "linenumber": 1588,
                                },
                            ],
                        }
                    ]
                }
            }
        ),
        'job_guid': test_job.guid,
    }
    store_job_artifacts([text_log_summary_artifact])

    assert TextLogError.objects.count() == 2
    assert TextLogError.objects.get(line_number=1587).line == '07:51:28  WARNING - \U000000c3'
    assert TextLogError.objects.get(line_number=1588).line == '07:51:29  WARNING - <U+01D400>'
