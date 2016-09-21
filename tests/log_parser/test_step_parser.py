from datetime import datetime

from treeherder.log_parser.parsers import StepParser


def test_date_with_milliseconds():
    """Handle buildbot dates that have a decimal on the seconds."""
    parser = StepParser()
    dt = parser._parse_full_timestamp('2015-01-20 16:42:33.352621')
    assert dt == datetime(2015, 1, 20, 16, 42, 33, 352621)


def test_date_without_milliseconds():
    """Handle buildbot dates that DON'T have a decimal on the seconds."""
    parser = StepParser()
    dt = parser._parse_full_timestamp('2015-01-20 16:42:33')
    assert dt == datetime(2015, 1, 20, 16, 42, 33)


def test_date_with_invalid_month():
    """Gracefully handle a date whose month is invalid."""
    parser = StepParser()

    assert parser._parse_full_timestamp('2016-00-04 19:44:35.838000') is None
    assert parser._parse_full_timestamp('2016-00-04 19:47:12.880000') is None

    parser.start_step(1, when=None)
    parser.end_step(2, when=None)
    assert parser.current_step['duration'] is None


def test_parse_buildbot_and_mozharness():
    parser = StepParser()

    lines = [
        "========= Started 'c:/mozilla-build/python27/python -u ...' (results: 0, elapsed: 25 mins, 40 secs) (at 2016-05-08 13:05:28.575691) =========",
        'c:/mozilla-build/python27/python' '-u' 'scripts/scripts/desktop_unittest.py' '--cfg' 'unittests/win_unittest.py' '--mochitest-suite' 'plain-chunked' '--total-chunks' '5' '--this-chunk' '1' '--blob-upload-branch' 'try' '--download-symbols' 'ondemand',
        'in dir C:\slave\test\. (timeout 1800 secs) (maxTime 7200 secs)',
        'watching logfiles {}',
        '13:05:28    INFO - #####',
        '13:05:28    INFO - ##### Running clobber step.',
        '13:05:28    INFO - #####',
        '13:05:28    INFO - Running pre - action listener: _resource_record_pre_action',
        '13:07:03    INFO - #####',
        '13:07:03    INFO - ##### Finished clobber step (success)',
        '13:07:03    INFO - #####',
        '13:07:03    INFO - #####',
        '13:07:03    INFO - ##### Running read-buildbot-config step.',
        '13:07:03    INFO - #####',
        '13:07:03    INFO - Running pre - action listener: _resource_record_pre_action',
        '13:07:03    INFO - Running main action method: read_buildbot_config',
        '13:07:03    INFO - #####',
        '13:07:03    INFO - ##### Finished read-buildbot-config step (success)',
        '13:07:03    INFO - #####',
        "========= Finished 'c:/mozilla-build/python27/python -u ...' (results: 0, elapsed: 25 mins, 40 secs) (at 2016-05-08 13:31:08.718641) =========",
    ]

    for i, l in enumerate(lines):
        parser.parse_line(l, i)

    parser.finish_parse(i)

    assert len(parser.steps) == 3

    assert parser.steps[1].name == 'clobber'
    assert parser.steps[1].result == 'success'
    assert parser.steps[1].duration == 95
    assert parser.steps[2].name == 'read-buildbot-config'
    assert parser.steps[2].result == 'success'
    assert parser.steps[2].duration == 0