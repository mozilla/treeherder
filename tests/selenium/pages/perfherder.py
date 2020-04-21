from pypom import Region
from selenium.webdriver.common.by import By

from .base import Base


class Perfherder(Base):
    URL_TEMPLATE = '/perf.html'

    @property
    def tool_tip(self):
        return self.GraphTooltip(self)

    def switch_to_treeherder(self):
        self.header.switch_app()
        from pages.treeherder import Treeherder

        return Treeherder(self.driver, self.base_url).wait_for_page_to_load()

    class GraphTooltip(Region):
        _root_locator = (By.ID, "graph-tooltip")
        _series_locator = (By.ID, "tt-series")
        _platform_locator = (By.ID, "tt-series2")

        @property
        def is_tooltip_visible(self):
            self.wait.until(lambda _: self.find_element(*self._series_locator).is_displayed())

            return self.is_element_displayed(*self._series_locator)

        @property
        def series_text(self):
            return self.find_element(*self._series_locator).text

        @property
        def platform_text(self):
            return self.find_element(*self._platform_locator).text
