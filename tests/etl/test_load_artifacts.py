import json

from treeherder.etl.artifact import store_job_artifacts
from treeherder.model.models import (TextLogError,
                                     TextLogStep)


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
