from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.select import Select

from .base import Base


class PerfherderCompare(Base):
    URL_TEMPLATE = '/perf.html#/comparechooser'

    _original_project_select_locator = (By.ID, "original-project-selector")
    _original_compare_specific_rev = (By.CSS_SELECTOR, 'ng-model="revisionComparison"')

    _new_project_select_locator = (By.ID, "new-project-selector")
    _new_project_revision_btn_locator = (By.CSS_SELECTOR, "#new-project button.btn")
    _new_project_revision_item_locator = (By.CSS_SELECTOR, "#new-project .dropdown-menu > li > a")

    _compare_btn_locator = (By.ID, "compare-button")

    def select_original_project(self, value):
        self.wait.until(lambda _: self.find_element(*self._compare_btn_locator).get_property("disabled"))

        select_project = Select(self.find_element(*self._original_project_select_locator))
        select_project.select_by_visible_text(value)

    def check_compare_specific_rev(self):
        self.find_element(*self._original_compare_specific_rev).click()

    def select_new_project(self, value):
        select_project = Select(self.find_element(*self._new_project_select_locator))
        select_project.select_by_visible_text(value)

    def select_new_revision(self, value):
        self.find_element(*self._new_project_revision_btn_locator).click()

        for item in self.find_elements(*self._new_project_revision_item_locator):
            if value in item.text:
                item.click()
                return

        raise NoSuchElementException("Could not locate element with visible text: %s" % value)

    def is_compare_button_clickable(self):
        return self.find_element(*self._compare_btn_locator).is_enabled()

    def click_compare_button(self):
        self.find_element(*self._compare_btn_locator).click()


class PerfherderCompareResults(Base):
    _base_revison_locator = (By.CSS_SELECTOR, "revision-information li.list-inline-item:nth-child(1)")
    _new_revison_locator = (By.CSS_SELECTOR, "revision-information li.list-inline-item:nth-child(2)")


