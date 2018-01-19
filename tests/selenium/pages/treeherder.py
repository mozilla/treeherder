import itertools
from contextlib import contextmanager

from django.conf import settings
from pypom import Region
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as expected

from .base import Base


class Treeherder(Base):

    URL_TEMPLATE = '/#/jobs?repo={}'.format(settings.TREEHERDER_TEST_REPOSITORY_NAME)

    _active_watched_repo_locator = (By.CSS_SELECTOR, '#watched-repo-navbar button.active')
    _filter_failures_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=failures]')
    _filter_in_progress_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title*=progress]')
    _filter_retry_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=retry]')
    _filter_success_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=success]')
    _filter_superseded_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=superseded]')
    _filter_usercancel_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=usercancel]')
    _filters_menu_locator = (By.ID, 'filterLabel')
    _quick_filter_locator = (By.ID, 'quick-filter')
    _repo_locator = (By.CSS_SELECTOR, '#repo-dropdown a[href*="repo={}"]')
    _repo_menu_locator = (By.ID, 'repoLabel')
    _result_sets_locator = (By.CSS_SELECTOR, '.result-set:not(.row)')
    _watched_repos_locator = (By.CSS_SELECTOR, '#watched-repo-navbar th-watched-repo')

    def wait_for_page_to_load(self):
        self.wait.until(lambda _: self.find_elements(*self._watched_repos_locator))
        return self

    @property
    def active_watched_repo(self):
        return self.find_element(*self._active_watched_repo_locator).text

    @property
    def all_jobs(self):
        return list(itertools.chain.from_iterable(
            r.jobs for r in self.result_sets))

    @contextmanager
    def filters_menu(self):
        el = self.find_element(*self._filters_menu_locator)
        el.click()
        yield self.FiltersMenu(self)
        el.click()

    @property
    def info_panel(self):
        return self.InfoPanel(self)

    @property
    def result_sets(self):
        return [self.ResultSet(self, el) for el in self.find_elements(*self._result_sets_locator)]

    @property
    def quick_filter_term(self):
        el = self.find_element(*self._quick_filter_locator)
        return el.get_attribute('value')

    def reset_filters(self):
        self.find_element(*self._filters_menu_locator).click()
        self.FiltersMenu(self).reset()

    def select_next_unclassified_job(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys('n')
        self.wait.until(lambda _: self.info_panel.is_open)

    def select_previous_unclassified_job(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys('p')
        self.wait.until(lambda _: self.info_panel.is_open)

    def select_repository(self, name):
        self.find_element(*self._repo_menu_locator).click()
        # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
        el = self.find_element(By.CSS_SELECTOR, 'body')
        locator = (self._repo_locator[0], self._repo_locator[1].format(name))
        self.find_element(*locator).click()
        self.wait.until(expected.staleness_of(el))
        self.wait_for_page_to_load()

    def switch_to_perfherder(self):
        self.header.switch_app()
        from pages.perfherder import Perfherder
        return Perfherder(self.selenium, self.base_url).wait_for_page_to_load()

    def toggle_failures(self):
        self.find_element(*self._filter_failures_locator).click()

    def toggle_in_progress(self):
        self.find_element(*self._filter_in_progress_locator).click()

    def toggle_retry(self):
        self.find_element(*self._filter_retry_locator).click()

    def toggle_success(self):
        self.find_element(*self._filter_success_locator).click()

    def toggle_superseded(self):
        self.find_element(*self._filter_superseded_locator).click()

    def toggle_usercancel(self):
        self.find_element(*self._filter_usercancel_locator).click()

    class FiltersMenu(Region):

        _root_locator = (By.ID, 'filter-dropdown')
        _busted_locator = (By.ID, 'busted')
        _exception_locator = (By.ID, 'exception')
        _reset_locator = (By.CSS_SELECTOR, 'li[title="Reset to default status filters"]')
        _success_locator = (By.ID, 'success')
        _testfailed_locator = (By.ID, 'testfailed')

        def reset(self):
            self.find_element(*self._reset_locator).click()

        def toggle_busted_jobs(self):
            self.find_element(*self._busted_locator).click()

        def toggle_exception_jobs(self):
            self.find_element(*self._exception_locator).click()

        def toggle_success_jobs(self):
            self.find_element(*self._success_locator).click()

        def toggle_testfailed_jobs(self):
            self.find_element(*self._testfailed_locator).click()

    class ResultSet(Region):

        _author_locator = (By.CSS_SELECTOR, '.result-set-title-left th-author a')
        _datestamp_locator = (By.CSS_SELECTOR, '.result-set-title-left > span a')
        _dropdown_toggle_locator = (By.CLASS_NAME, 'dropdown-toggle')
        _commits_locator = (By.CSS_SELECTOR, '.revision-list .revision')
        _jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown')
        _set_bottom_of_range_locator = (By.CSS_SELECTOR, 'ul.dropdown-menu > li:nth-child(9) > a')
        _set_top_of_range_locator = (By.CSS_SELECTOR, 'ul.dropdown-menu > li:nth-child(8) > a')

        @property
        def author(self):
            return self.find_element(*self._author_locator).text

        @property
        def datestamp(self):
            return self.find_element(*self._datestamp_locator).text

        @property
        def jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._jobs_locator)]

        @property
        def commits(self):
            return [self.page.Commit(self.page, el) for el in self.find_elements(*self._commits_locator)]

        def set_as_bottom_of_range(self):
            # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
            el = self.page.find_element(By.CSS_SELECTOR, 'body')
            self.find_element(*self._dropdown_toggle_locator).click()
            self.find_element(*self._set_bottom_of_range_locator).click()
            self.wait.until(expected.staleness_of(el))
            self.page.wait_for_page_to_load()

        def set_as_top_of_range(self):
            # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
            el = self.page.find_element(By.CSS_SELECTOR, 'body')
            self.find_element(*self._dropdown_toggle_locator).click()
            self.find_element(*self._set_top_of_range_locator).click()
            self.wait.until(expected.staleness_of(el))
            self.page.wait_for_page_to_load()

        def view(self):
            # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
            el = self.page.find_element(By.CSS_SELECTOR, 'body')
            self.find_element(*self._datestamp_locator).click()
            self.wait.until(expected.staleness_of(el))
            self.page.wait_for_page_to_load()

        class Job(Region):

            def click(self):
                self.root.click()
                self.wait.until(lambda _: self.page.info_panel.is_open)

            @property
            def selected(self):
                return 'selected-job' in self.root.get_attribute('class')

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

    class InfoPanel(Region):

        _root_locator = (By.ID, 'info-panel')
        _loading_locator = (By.CSS_SELECTOR, '.overlay')

        @property
        def is_open(self):
            return self.root.is_displayed() and \
                not self.find_elements(*self._loading_locator)

        @property
        def job_details(self):
            return self.JobDetails(self.page)

        class JobDetails(Region):

            _root_locator = (By.ID, 'job-details-panel')
            _keywords_locator = (By.CSS_SELECTOR, 'a[title="Filter jobs containing these keywords"]')
            _result_locator = (By.CSS_SELECTOR, '#result-status-pane div:nth-of-type(1) span')

            @property
            def keywords(self):
                return self.find_element(*self._keywords_locator).text

            @property
            def result(self):
                return self.find_element(*self._result_locator).text

            def filter_by_keywords(self):
                self.find_element(*self._keywords_locator).click()
