# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_by_job_keyword(base_url, selenium):
    """Open Treeherder page, select random job, click on the job keyword,
    verify if filtered jobs have the same platform name"""
    page = TreeherderPage(selenium, base_url).open()
    page.select_random_job()

    page.info_panel.job_details.filter_by_job_keyword()
    keyword = page.info_panel.job_details.job_keyword_name

    page.select_random_job()
    assert keyword in page.info_panel.job_details.job_keyword_name
