from pypom import (Page,
                   Region)
from selenium.webdriver.common.by import By


class Base(Page):

    @property
    def header(self):
        return self.Header(self)

    class Header(Region):

        _root_locator = (By.ID, 'th-global-navbar')
        _app_menu_locator = (By.ID, 'th-logo')
        _switch_app_locator = (By.CSS_SELECTOR, '#th-logo + ul > li a')

        @property
        def active_app(self):
            return self.find_element(*self._app_menu_locator).text

        def switch_app(self):
            self.find_element(*self._app_menu_locator).click()
            self.find_element(*self._switch_app_locator).click()


class Modal(Region):

    _root_locator = (By.CSS_SELECTOR, '.modal-dialog')

    @property
    def is_displayed(self):
        return self.root.is_displayed()
