# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_by_email(base_url, selenium):
    """Open resultset page and search for next unclassified failure"""
    page = TreeherderPage(selenium, base_url).open()
    assert page.unclassified_failure_count > 0
    email = page.result_sets[0].email_address
    print email

