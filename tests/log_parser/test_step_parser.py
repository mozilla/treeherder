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
