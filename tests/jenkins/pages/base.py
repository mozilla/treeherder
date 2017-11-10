from pypom import Page, Region
from selenium.webdriver.common.by import By


class Base(Page):

    def __init__(self, driver, base_url=None, timeout=20, **url_kwargs):
        super(Base, self).__init__(driver, base_url, timeout, **url_kwargs)

    @property
    def header(self):
        return self.Header(self)

    class Header(Region):

        _root_locator = (By.ID, 'th-global-navbar')
        _dropdown_menu_switch_page_locator = (By.CSS_SELECTOR, 'ul.show > li a')
        _dropdown_menu_locator = (By.ID, 'th-logo')

        def switch_page_using_dropdown(self):
            self.find_element(*self._dropdown_menu_locator).click()
            self.find_element(*self._dropdown_menu_switch_page_locator).click()
