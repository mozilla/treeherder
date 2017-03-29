# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_treeherder_dropdown(base_url, selenium):
    """Switch between Treeherder and Perfherder using header dropdown"""
    treeherder_page = TreeherderPage(selenium, base_url).open()

    # Switch to Perfherder page
    perfherder_page = treeherder_page.open_perfherder_page()
    assert perfherder_page.is_graph_chooser_displayed

    # Return to Treeherder page
    treeherder_page = perfherder_page.open_treeherder_page()
