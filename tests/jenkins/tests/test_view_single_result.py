# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_open_single_result(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    assert len(page.result_sets) > 1
    datestamp = page.result_sets[0].datestamp
    page.result_sets[0].view()
    assert 1 == len(page.result_sets)
    assert datestamp == page.result_sets[0].datestamp
