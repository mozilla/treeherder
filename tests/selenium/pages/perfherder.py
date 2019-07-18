from pypom import Region
from selenium.webdriver.common.by import By
from selenium.webdriver.support.select import Select

from .base import (Base,
                   Modal)


# TODO fix tests to work with react
class Perfherder(Base):
    URL_TEMPLATE = '/perf.html'

    # _add_test_data_locator = (By.ID, 'add-test-data-button')
    # _test_series_locator = (By.CSS_SELECTOR, 'tr[ng-repeat*="series"]')

    # @property
    # def loaded(self):
    #     return self.is_element_displayed(By.CSS_SELECTOR, '#graph canvas')

    def add_test_data(self):
        self.find_element(*self._add_test_data_locator).click()
        self.wait.until(lambda _: self.PerformanceTestChooserModal(self).is_displayed)

        return self.PerformanceTestChooserModal(self)

    @property
    def tool_tip(self):
        return self.GraphTooltip(self)

    def switch_to_treeherder(self):
        self.header.switch_app()
        from pages.treeherder import Treeherder
        return Treeherder(self.driver, self.base_url).wait_for_page_to_load()

    def series_list(self):
        return [self.Series(self, element)
                for element in self.find_elements(*self._test_series_locator)]

    class PerformanceTestChooserModal(Modal):
        _selct_frammework_locator = (By.CSS_SELECTOR, 'select[ng-model="selectedFramework"]')
        _selct_project_locator = (By.CSS_SELECTOR, 'select[ng-model="selectedProject"]')
        _selct_platform_locator = (By.CSS_SELECTOR, 'select[ng-model="selectedPlatform"]')
        _selct_test_signature_locator = (By.CSS_SELECTOR, 'select[ng-model="selectedTestSignatures"]')
        _select_test_to_add_locator = (By.CSS_SELECTOR, 'select[ng-model="selectedTestsToAdd"]')

        _select_test_button_locator = (By.ID, 'select-test')
        _add_button_locator = (By.CSS_SELECTOR, 'div.modal-footer > button')

        def select_test(self, perf_datum):
            select_frammework = Select(self.find_element(*self._selct_frammework_locator))
            select_frammework.select_by_visible_text(perf_datum.signature.framework.name)

            select_project = Select(self.find_element(*self._selct_project_locator))
            select_project.select_by_visible_text(perf_datum.repository.name)

            select_platform = Select(self.find_element(*self._selct_platform_locator))
            select_platform.select_by_visible_text(perf_datum.signature.platform.platform)

            select_test_signature = Select(self.find_element(*self._selct_test_signature_locator))
            select_test_signature.select_by_value(perf_datum.signature.signature_hash)

            self.find_element(*self._select_test_button_locator).click()

            self.find_element(*self._add_button_locator).click()

    class Series(Region):
        _signature_locator = (By.CSS_SELECTOR, 'div.signature')
        _test_name_locator = (By.ID, 'test-name')
        _project_name_locator = (By.ID, 'project-name')
        _platform_locator = (By.ID, 'platform')

        @property
        def signature_text(self):
            return self.find_element(*self._signature_locator).text

        @property
        def test_name_text(self):
            return self.find_element(*self._test_name_locator).text

        @property
        def project_name_text(self):
            return self.find_element(*self._project_name_locator).text

        @property
        def platform_text(self):
            return self.find_element(*self._platform_locator).text

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
