import itertools
from contextlib import contextmanager

from django.conf import settings
from pypom import Region
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as expected

from .base import Base


class Treeherder(Base):

    URL_TEMPLATE = '/#/jobs?repo={}'.format(settings.TREEHERDER_TEST_REPOSITORY_NAME)

    _active_watched_repo_locator = (By.CSS_SELECTOR, '#watched-repo-navbar a.active')
    _clear_filter_locator = (By.ID, 'quick-filter-clear-button')
    _filter_failures_locator = (By.CSS_SELECTOR, '.btn-nav-filter[aria-label=failures]')
    _filter_in_progress_locator = (By.CSS_SELECTOR, '.btn-nav-filter[aria-label*=progress]')
    _filter_retry_locator = (By.CSS_SELECTOR, '.btn-nav-filter[aria-label=retry]')
    _filter_success_locator = (By.CSS_SELECTOR, '.btn-nav-filter[aria-label=success]')
    _filter_superseded_locator = (By.CSS_SELECTOR, '.btn-nav-filter[aria-label=superseded]')
    _filter_usercancel_locator = (By.CSS_SELECTOR, '.btn-nav-filter[aria-label=usercancel]')
    _filters_menu_locator = (By.ID, 'filterLabel')
    _get_next_10_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(1)')
    _get_next_20_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(2)')
    _get_next_50_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(3)')
    _quick_filter_locator = (By.ID, 'quick-filter')
    _repo_locator = (By.CSS_SELECTOR, '#repo-dropdown a[href*="repo={}"]')
    _repo_menu_locator = (By.ID, 'repoLabel')
    _pushes_locator = (By.CSS_SELECTOR, '.push:not(.row)')
    _unclassified_filter_locator = (By.CSS_SELECTOR, '.btn-unclassified-failures')
    _watched_repos_locator = (By.CSS_SELECTOR, '#watched-repo-navbar .watched-repos')

    @property
    def loaded(self):
        return self.find_elements(*self._watched_repos_locator)

    @property
    def active_filters(self):
        return self.ActiveFilters(self)

    @property
    def active_watched_repo(self):
        self.wait.until(lambda _: self.is_element_displayed(
            *self._active_watched_repo_locator))
        return self.find_element(*self._active_watched_repo_locator).text

    @property
    def all_jobs(self):
        return list(itertools.chain.from_iterable(
            r.jobs for r in self.pushes))

    @property
    def all_job_groups(self):
        return list(itertools.chain.from_iterable(
            r.job_groups for r in self.pushes))

    def clear_filter(self, method='pointer'):
        if method == 'keyboard':
            self._keyboard_shortcut(Keys.CONTROL + Keys.SHIFT + 'f')
        else:
            self.find_element(*self._clear_filter_locator).click()

    def filter_by(self, term, method='pointer'):
        if method == 'keyboard':
            self._keyboard_shortcut('f' + term + Keys.RETURN)
        else:
            el = self.find_element(*self._quick_filter_locator)
            el.send_keys(term + Keys.RETURN)
        return self.wait_for_page_to_load()

    @contextmanager
    def filters_menu(self):
        el = self.find_element(*self._filters_menu_locator)
        el.click()
        yield self.FiltersMenu(self)
        el.click()

    def filter_unclassified_jobs(self):
        self.find_element(*self._unclassified_filter_locator).click()

    def _get_next(self, count):
        before = len(self.pushes)
        locator = getattr(self, '_get_next_{}_locator'.format(count))
        self.find_element(*locator).click()
        self.wait.until(lambda s: len(self.pushes) == before + count)

    def get_next_10(self):
        self._get_next(10)

    def get_next_20(self):
        self._get_next(20)

    def get_next_50(self):
        self._get_next(50)

    @property
    def details_panel(self):
        return self.DetailsPanel(self)

    def _keyboard_shortcut(self, shortcut):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys(shortcut)

    @property
    def pushes(self):
        return [self.ResultSet(self, el) for el in self.find_elements(*self._pushes_locator)]

    @property
    def quick_filter_term(self):
        el = self.find_element(*self._quick_filter_locator)
        return el.get_attribute('value')

    def reset_filters(self):
        self.find_element(*self._filters_menu_locator).click()
        self.FiltersMenu(self).reset()

    def select_next_job(self):
        self._keyboard_shortcut(Keys.ARROW_RIGHT)

    def select_next_unclassified_job(self):
        self._keyboard_shortcut('n')
        self.wait.until(lambda _: self.details_panel.is_open)

    def select_previous_job(self):
        self._keyboard_shortcut(Keys.ARROW_LEFT)

    def select_previous_unclassified_job(self):
        self._keyboard_shortcut('p')
        self.wait.until(lambda _: self.details_panel.is_open)

    def select_repository(self, name):
        self.find_element(*self._repo_menu_locator).click()
        locator = (self._repo_locator[0], self._repo_locator[1].format(name))
        self.find_element(*locator).click()
        self.wait_for_page_to_load()

    def switch_to_perfherder(self):
        self.header.switch_app()
        from pages.perfherder import Perfherder
        return Perfherder(self.driver, self.base_url).wait_for_page_to_load()

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

    class ActiveFilters(Region):

        _root_locator = (By.CSS_SELECTOR, '.active-filters-bar')
        _clear_locator = (By.CSS_SELECTOR, '.pointable')
        _filters_locator = (By.CSS_SELECTOR, '.filtersbar-filter')

        def clear(self):
            self.find_element(*self._clear_locator).click()
            return self.page.wait_for_page_to_load()

        @property
        def filters(self):
            els = self.find_elements(*self._filters_locator)
            return [self.Filter(self.page, el) for el in els]

        class Filter(Region):

            _clear_locator = (By.CSS_SELECTOR, '.pointable')
            _field_locator = (By.CSS_SELECTOR, 'span:nth-child(2) b')
            _value_locator = (By.CSS_SELECTOR, 'span:nth-child(2) span')

            @property
            def field(self):
                return self.find_element(*self._field_locator).text

            @property
            def value(self):
                return self.find_element(*self._value_locator).text

            def clear(self):
                self.find_element(*self._clear_locator).click()
                return self.page.wait_for_page_to_load()

    class ResultSet(Region):

        _author_locator = (By.CSS_SELECTOR, '.push-title-left .push-author a')
        _datestamp_locator = (By.CSS_SELECTOR, '.push-title-left > span a')
        _dropdown_toggle_locator = (By.CLASS_NAME, 'dropdown-toggle')
        _commits_locator = (By.CSS_SELECTOR, '.revision-list .revision')
        _job_groups_locator = (By.CSS_SELECTOR, '.job-group')
        _jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown')
        _set_bottom_of_range_locator = (By.CLASS_NAME, 'bottom-of-range-menu-item')
        _set_top_of_range_locator = (By.CLASS_NAME, 'top-of-range-menu-item')

        @property
        def author(self):
            return self.find_element(*self._author_locator).text

        @property
        def datestamp(self):
            return self.find_element(*self._datestamp_locator).text

        @property
        def job_groups(self):
            return [self.JobGroup(self.page, root=el) for el in self.find_elements(*self._job_groups_locator)]

        @property
        def jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._jobs_locator)]

        @property
        def commits(self):
            return [self.page.Commit(self.page, el) for el in self.find_elements(*self._commits_locator)]

        def filter_by_author(self):
            self.find_element(*self._author_locator).click()
            return self.page.wait_for_page_to_load()

        def set_as_bottom_of_range(self):
            el = self.page.find_element(By.CSS_SELECTOR, '.push')
            self.find_element(*self._dropdown_toggle_locator).click()
            self.find_element(*self._set_bottom_of_range_locator).click()
            self.wait.until(expected.staleness_of(el))
            self.page.wait_for_page_to_load()

        def set_as_top_of_range(self):
            el = self.page.find_element(By.CSS_SELECTOR, '.push')
            self.find_element(*self._dropdown_toggle_locator).click()
            self.find_element(*self._set_top_of_range_locator).click()
            self.wait.until(expected.staleness_of(el))
            self.page.wait_for_page_to_load()

        def view(self):
            self.find_element(*self._datestamp_locator).click()
            self.page.wait_for_page_to_load()

        class Job(Region):

            def click(self):
                self.root.click()
                self.wait.until(lambda _: self.page.details_panel.is_open)

            @property
            def selected(self):
                return 'selected-job' in self.root.get_attribute('class')

            @property
            def symbol(self):
                return self.root.text

        class JobGroup(Region):

            _jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown')
            _expand_locator = (By.CSS_SELECTOR, '.group-btn')

            def expand(self):
                assert not self.expanded
                self.find_element(*self._expand_locator).click()
                self.wait.until(lambda _: self.expanded)

            @property
            def expanded(self):
                return not self.is_element_present(*self._expand_locator)

            @property
            def jobs(self):
                return [Treeherder.ResultSet.Job(self.page, root=el) for el in self.find_elements(*self._jobs_locator)]

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

    class DetailsPanel(Region):

        _root_locator = (By.ID, 'details-panel')
        _close_locator = (By.CSS_SELECTOR, '.details-panel-close-btn')
        _loading_locator = (By.CSS_SELECTOR, '.overlay')

        def close(self, method='pointer'):
            if method == 'keyboard':
                self.page._keyboard_shortcut(Keys.ESCAPE)
            else:
                self.find_element(*self._close_locator).click()
            self.wait.until(lambda _: not self.is_open)

        @property
        def is_open(self):
            return self.root.is_displayed() and \
                not self.find_elements(*self._loading_locator) and \
                self.job_details.result

        @property
        def job_details(self):
            return self.SummaryPanel(self.page)

        class SummaryPanel(Region):

            _root_locator = (By.ID, 'summary-panel')
            _keywords_locator = (By.CSS_SELECTOR, 'a[title="Filter jobs containing these keywords"]')
            _log_viewer_locator = (By.CLASS_NAME, 'logviewer-btn')
            _result_locator = (By.CSS_SELECTOR, '#result-status-pane div:nth-of-type(1) span')

            @property
            def keywords(self):
                return self.find_element(*self._keywords_locator).text

            @property
            def result(self):
                return self.find_element(*self._result_locator).text

            def filter_by_keywords(self):
                self.find_element(*self._keywords_locator).click()

            def open_log_viewer(self, method='pointer'):
                if method == 'keyboard':
                    self.page._keyboard_shortcut('l')
                else:
                    self.find_element(*self._log_viewer_locator).click()
                self.wait.until(lambda s: len(s.window_handles) == 2)
                handles = self.driver.window_handles
                handles.remove(self.driver.current_window_handle)
                self.driver.switch_to.window(handles[0])

                from pages.log_viewer import LogViewer
                return LogViewer(self.driver).wait_for_page_to_load()
