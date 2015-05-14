# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from treeherder.log_parser.parsers import StepParser
from datetime import datetime


def test_date_with_milliseconds():
    """Handle buildbot dates that have a decimal on the seconds."""
    parser = StepParser()
    dt = parser.parsetime('2015-01-20 16:42:33.352621')
    assert dt == datetime(2015, 1, 20, 16, 42, 33, 352621)


def test_date_without_milliseconds():
    """Handle buildbot dates that DON'T have a decimal on the seconds."""
    parser = StepParser()
    dt = parser.parsetime('2015-01-20 16:42:33')
    assert dt == datetime(2015, 1, 20, 16, 42, 33)
