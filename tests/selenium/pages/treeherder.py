from pypom import Page
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as expected


class Treeherder(Page):

    _active_watched_repo_locator = (By.CSS_SELECTOR, '#watched-repo-navbar button.active')
    _mozilla_central_repo_locator = (By.CSS_SELECTOR, '#repo-dropdown a[href*="repo=mozilla-central"]')
    _repos_menu_locator = (By.ID, 'repoLabel')

    def wait_for_page_to_load(self):
        self.wait.until(lambda _: self.is_element_displayed(*self._active_watched_repo_locator))
        return self

    @property
    def active_watched_repo(self):
        return self.find_element(*self._active_watched_repo_locator).text

    def select_mozilla_central_repo(self):
        self.find_element(*self._repos_menu_locator).click()
        # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
        el = self.find_element(By.CSS_SELECTOR, 'body')
        self.find_element(*self._mozilla_central_repo_locator).click()
        self.wait.until(expected.staleness_of(el))
        self.wait_for_page_to_load()
