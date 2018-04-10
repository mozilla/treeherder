import itertools
import random

from pypom import Page, Region
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys


class TreeherderPage(Page):

    _active_watched_repo_locator = (By.CSS_SELECTOR, '#watched-repo-navbar button.active')
    _clear_filter_locator = (By.ID, 'quick-filter-clear-button')
    _info_panel_content_locator = (By.ID, 'info-panel-content')
    _get_next_10_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(1)')
    _get_next_20_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(2)')
    _get_next_50_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(3)')
    _quick_filter_locator = (By.ID, 'quick-filter')
    _pushes_locator = (By.CSS_SELECTOR, '.push:not(.row)')
    _unchecked_repos_links_locator = (By.CSS_SELECTOR, '#repoLabel + .dropdown-menu .dropdown-checkbox:not([checked]) + .dropdown-link')
    _unclassified_failure_count_locator = (By.ID, 'unclassified-failure-count')
    _unclassified_failure_filter_locator = (By.CSS_SELECTOR, '.btn-unclassified-failures')

    def __init__(self, driver, base_url=None, timeout=20, **url_kwargs):
        super(TreeherderPage, self).__init__(driver, base_url, timeout, **url_kwargs)

    def wait_for_page_to_load(self):
        self.wait.until(lambda s: len(self.all_jobs) >= 1)
        return self

    @property
    def all_jobs(self):
        return list(itertools.chain.from_iterable(
            r.jobs for r in self.pushes))

    @property
    def info_panel(self):
        return self.InfoPanel(self)

    @property
    def pushes(self):
        return [self.ResultSet(self, el) for el in self.find_elements(*self._pushes_locator)]

    @property
    def search_term(self):
        el = self.find_element(*self._quick_filter_locator)
        return el.get_attribute('value')

    @property
    def unchecked_repos(self):
        return self.find_elements(*self._unchecked_repos_links_locator)

    @property
    def unclassified_failure_count(self):
        return int(self.find_element(*self._unclassified_failure_count_locator).text)

    def clear_filter(self, method='pointer'):
        if method == 'pointer':
            self.selenium.find_element(*self._clear_filter_locator).click()
        elif method == 'keyboard':
            self.find_element(By.CSS_SELECTOR, 'body').send_keys(
                Keys.CONTROL + Keys.SHIFT + 'f')
        else:
            raise Exception('Unsupported method: {}'.format(method))

    def click_on_active_watched_repo(self):
        # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
        el = self.find_element(By.CSS_SELECTOR, 'body')
        self.find_element(*self._active_watched_repo_locator).click()
        self.wait.until(EC.staleness_of(el))
        self.wait_for_page_to_load()

    def close_all_panels(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys(Keys.ESCAPE)

    def filter_by(self, term, method='pointer'):
        if method == 'pointer':
            el = self.selenium.find_element(*self._quick_filter_locator)
            el.send_keys(term)
            el.send_keys(Keys.RETURN)
            self.wait.until(lambda s: self.pushes)
        elif method == 'keyboard':
            self.find_element(By.CSS_SELECTOR, 'body').send_keys(
                'f' + term + Keys.RETURN)
        else:
            raise Exception('Unsupported method: {}'.format(method))

    def filter_unclassified_jobs(self):
        self.find_element(*self._unclassified_failure_filter_locator).click()

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

    def open_next_unclassified_failure(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys('n')
        self.wait.until(lambda _: self.info_panel.is_open)

    def select_next_job(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys(Keys.ARROW_RIGHT)

    def select_previous_job(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys(Keys.ARROW_LEFT)

    def select_random_job(self):
        random_job = random.choice(self.all_jobs)
        random_job.click()

    class ResultSet(Region):

        _busted_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-red')
        _datestamp_locator = (By.CSS_SELECTOR, '.push-title-left > span a')
        _exception_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-purple')
        _jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown')
        _pending_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-ltgray')
        _restarted_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-dkblue')
        _running_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-dkgray')
        _successful_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-green')
        _superseded_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-ltblue')
        _tests_failed_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-orange')

        @property
        def busted_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._busted_jobs_locator)]

        @property
        def exception_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._exception_jobs_locator)]

        @property
        def failed_jobs(self):
            return self.busted_jobs + self.exception_jobs + self.tests_failed_jobs

        @property
        def in_progress_jobs(self):
            return self.pending_jobs + self.running_jobs

        @property
        def jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._jobs_locator)]

        @property
        def pending_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._pending_jobs_locator)]

        @property
        def restarted_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._restarted_jobs_locator)]

        @property
        def running_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._running_jobs_locator)]

        @property
        def successful_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._successful_jobs_locator)]

        @property
        def superseded_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._superseded_jobs_locator)]

        @property
        def tests_failed_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._tests_failed_jobs_locator)]

        def view(self):
            # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
            el = self.page.find_element(By.CSS_SELECTOR, 'body')
            self.find_element(*self._datestamp_locator).click()
            self.wait.until(EC.staleness_of(el))
            self.page.wait_for_page_to_load()

        class Job(Region):

            @property
            def in_progress(self):
                classes = self.root.get_attribute('class').split()
                return any(c in ('btn-dkgray', 'btn-ltgray') for c in classes)

            @property
            def selected(self):
                return 'selected-job' in self.root.get_attribute('class')

            @property
            def title(self):
                return self.root.get_attribute('title')

            def click(self):
                self.root.click()
                self.wait.until(lambda _: self.page.info_panel.is_open)

        class JobGroup(Region):

            _jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown')
            _expand_locator = (By.CSS_SELECTOR, '.group-btn')

            def expand(self):
                assert not self.expanded
                self.find_element(*self._expand_locator).click()
                self.wait.until(lambda s: self.expanded)

            @property
            def expanded(self):
                return not self.is_element_present(*self._expand_locator)

            @property
            def jobs(self):
                return [TreeherderPage.ResultSet.Job(self.page, root=el) for el in self.find_elements(*self._jobs_locator)]

    class InfoPanel(Region):

        _root_locator = (By.ID, 'info-panel')
        _loading_locator = (By.CSS_SELECTOR, '.overlay')

        @property
        def is_open(self):
            return self.root.is_displayed() and \
                not any(self.find_elements(*self._loading_locator))

        @property
        def job_details(self):
            return self.JobDetails(self.page)

        class JobDetails(Region):

            _root_locator = (By.ID, 'job-details-panel')
            _job_keyword_locator = (By.CSS_SELECTOR, '#job-details-pane > ul > li > a:nth-last-child(1)')
            _logviewer_button_locator = (By.ID, 'logviewer-btn')

            @property
            def job_keyword_name(self):
                return self.find_element(*self._job_keyword_locator).text

            def filter_by_job_keyword(self):
                self.find_element(*self._job_keyword_locator).click()

            def open_logviewer(self):
                self.root.send_keys('l')
                window_handles = self.selenium.window_handles
                for handle in window_handles:
                    self.selenium.switch_to.window(handle)
                return LogviewerPage(self.selenium, self.page.base_url).wait_for_page_to_load()


class LogviewerPage(Page):

    _job_header_locator = (By.CSS_SELECTOR, 'div.job-header')

    def wait_for_page_to_load(self):
        self.wait.until(lambda s: self.is_job_status_visible)
        return self

    @property
    def is_job_status_visible(self):
        return self.is_element_displayed(*self._job_header_locator)
