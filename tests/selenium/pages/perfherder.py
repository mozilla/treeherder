from selenium.webdriver.common.by import By

from .base import (Base,
                   Modal)


class Perfherder(Base):
    URL_TEMPLATE = '/perf.html'

    _add_test_data_locator = (By.ID, 'add-test-data-button')

    @property
    def loaded(self):
        return self.is_element_displayed(By.CSS_SELECTOR, '#graph canvas')

    def add_test_data(self):
        self.find_element(*self._add_test_data_locator).click()
        self.wait.until(lambda _: Modal(self).is_displayed)

    def switch_to_treeherder(self):
        self.header.switch_app()
        from pages.treeherder import Treeherder
        return Treeherder(self.driver, self.base_url).wait_for_page_to_load()
