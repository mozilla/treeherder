from pypom import Region
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as expected

from .base import Base


class Treeherder(Base):

    _active_watched_repo_locator = (By.CSS_SELECTOR, '#watched-repo-navbar button.active')
    _mozilla_central_repo_locator = (By.CSS_SELECTOR, '#repo-dropdown a[href*="repo=mozilla-central"]')
    _repos_menu_locator = (By.ID, 'repoLabel')
    _result_sets_locator = (By.CSS_SELECTOR, '.result-set:not(.row)')

    def wait_for_page_to_load(self):
        self.wait.until(lambda _: self.is_element_displayed(*self._active_watched_repo_locator))
        return self

    @property
    def active_watched_repo(self):
        return self.find_element(*self._active_watched_repo_locator).text

    @property
    def result_sets(self):
        return [self.ResultSet(self, el) for el in self.find_elements(*self._result_sets_locator)]

    def select_mozilla_central_repo(self):
        self.find_element(*self._repos_menu_locator).click()
        # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
        el = self.find_element(By.CSS_SELECTOR, 'body')
        self.find_element(*self._mozilla_central_repo_locator).click()
        self.wait.until(expected.staleness_of(el))
        self.wait_for_page_to_load()

    def switch_to_perfherder(self):
        self.header.switch_app()
        from pages.perfherder import Perfherder
        return Perfherder(self.selenium, self.base_url).wait_for_page_to_load()

    class ResultSet(Region):

        _author_locator = (By.CSS_SELECTOR, '.result-set-title-left th-author a')
        _datestamp_locator = (By.CSS_SELECTOR, '.result-set-title-left > span a')
        _commits_locator = (By.CSS_SELECTOR, '.revision-list .revision')

        @property
        def author(self):
            return self.find_element(*self._author_locator).text

        @property
        def datestamp(self):
            return self.find_element(*self._datestamp_locator).text

        @property
        def commits(self):
            return [self.page.Commit(self.page, el) for el in self.find_elements(*self._commits_locator)]

        def view(self):
            # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
            el = self.page.find_element(By.CSS_SELECTOR, 'body')
            self.find_element(*self._datestamp_locator).click()
            self.wait.until(expected.staleness_of(el))
            self.page.wait_for_page_to_load()

    class Commit(Region):

        _revision_locator = (By.CSS_SELECTOR, '.revision-holder a')
        _author_locator = (By.CSS_SELECTOR, '.user-push-initials')
        _comment_locator = (By.CSS_SELECTOR, '.revision-comment')

        @property
        def revision(self):
            return self.find_element(*self._revision_locator).text

        @property
        def author(self):
            return self.find_element(*self._author_locator).text

        @property
        def comment(self):
            return self.find_element(*self._comment_locator).text
