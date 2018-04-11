from pypom import Page
from selenium.webdriver.common.by import By


class LogViewer(Page):

    URL_TEMPLATE = '/logviewer.html'

    _logo_locator = (By.ID, 'lv-logo')

    def wait_for_page_to_load(self):
        self.wait.until(lambda _: self.is_element_displayed(*self._logo_locator))
        return self
