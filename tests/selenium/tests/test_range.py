# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_set_as_top_of_range(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    current_top_of_range = page.result_sets[0].datestamp
    page.result_sets[1].set_as_top_of_range()
    page.wait_for_page_to_load()
    new_top_of_range = page.result_sets[0].datestamp
    assert not new_top_of_range == current_top_of_range


@pytest.mark.nondestructive
def test_set_as_bottom_of_range(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    current_bottom_of_range = page.result_sets[9].datestamp
    page.result_sets[0].set_as_bottom_of_range()
    new_bottom_of_range = page.result_sets[0].datestamp
    assert not new_bottom_of_range == current_bottom_of_range
