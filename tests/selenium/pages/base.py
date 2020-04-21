from pypom import Page, Region
from selenium.webdriver.common.by import By


class Base(Page):
    @property
    def header(self):
        return self.Header(self)

    class Header(Region):

        _root_locator = (By.ID, 'th-global-navbar')
        _app_menu_locator = (By.ID, 'th-logo')
        _app_logo_locator = (By.CSS_SELECTOR, '#th-logo img')
        _switch_app_locator = (By.CSS_SELECTOR, '#th-logo + div > a')

        @property
        def active_app(self):
            # Initially try to compare with the text of the menu item.
            # But if there's an image instead of just text, then compare the
            # ``alt`` property of the image instead.
            self.wait.until(lambda _: self.is_element_displayed(*self._app_menu_locator))
            menu = self.find_element(*self._app_menu_locator).text
            return menu if menu else self.find_element(*self._app_logo_locator).get_attribute("alt")

        def switch_app(self):
            self.find_element(*self._app_menu_locator).click()
            self.find_element(*self._switch_app_locator).click()


class Modal(Region):

    _root_locator = (By.CSS_SELECTOR, '.modal-dialog')

    @property
    def is_displayed(self):
        return self.root.is_displayed()
