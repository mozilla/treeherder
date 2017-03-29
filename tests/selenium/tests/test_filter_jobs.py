# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_jobs(base_url, selenium):
    """Open resultset page and filter for platform"""
    page = TreeherderPage(selenium, base_url).open()
    platform = u'Linux'

    page.filter_by(platform)
    assert platform in page.result_sets[0].builds[0].platform_name

    page.clear_filter()
    platform2 = u'Windows'
    page.filter_by(platform2)
    assert platform not in page.result_sets[0].builds[0].platform_name
