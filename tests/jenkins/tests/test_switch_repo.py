# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_switch_repo(base_url, selenium):
    """Switch to new active watched repo"""
    page = TreeherderPage(selenium, base_url).open()
    assert 'mozilla-inbound' == page.active_watched_repo
    page.select_mozilla_central_repo()
    assert 'mozilla-central' == page.active_watched_repo
