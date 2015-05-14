# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from treeherder.log_parser.parsers import TalosParser


def test_valid_talosdata():
    valid_line = '10:27:39     INFO -  INFO : TALOSDATA: [ { "json": "blob" } ]'
    parser = TalosParser()
    parser.parse_line(valid_line, 1)
    assert parser.artifact[0].keys()[0] == 'json'


def test_invalid_talosdata():
    invalid_line = '10:27:39     INFO -  INFO : TALOSDATA: [ { "json"'
    parser = TalosParser()
    with pytest.raises(ValueError):
        parser.parse_line(invalid_line, 1)
