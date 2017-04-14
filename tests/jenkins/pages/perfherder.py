# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from selenium.webdriver.common.by import By

from pages.base import Base


class PerfherderPage(Base):

    _graph_chooser_locator = (By.ID, 'graph-chooser')

    def wait_for_page_to_load(self):
        self.wait.until(lambda s: self.is_graph_chooser_displayed)
        return self

    @property
    def is_graph_chooser_displayed(self):
        return self.is_element_displayed(*self._graph_chooser_locator)

    def open_treeherder_page(self):
        self.header.switch_page_using_dropdown()

        from treeherder import TreeherderPage
        return TreeherderPage(self.selenium, self.base_url).wait_for_page_to_load()
