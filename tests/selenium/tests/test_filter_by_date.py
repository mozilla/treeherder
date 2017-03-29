# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_by_date(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    top_datestamp = page.result_sets[0].datestamp
    bottom_datestamp = page.result_sets[9].datestamp
    daterange = page.open_date_range(2016-05-06, 2016-05-07).open()
    start_date = page.result_sets[0].datestamp
    end_date = page.result_sets[9].datestamp

    assert not top_datestamp == start_date
    assert not bottom_datestamp == end_date