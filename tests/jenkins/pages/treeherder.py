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
    _nav_filter_superseded_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=superseded]')
    _nav_filter_failures_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=failures]')
    _nav_filter_inprogress_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title*=progress]')
    _nav_filter_retry_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=retry]')
    _nav_filter_successes_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=success]')
    _nav_filter_usercancel_locator = (By.CSS_SELECTOR, '.btn-nav-filter[title=usercancel]')
    _get_next_10_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(1)')
    _get_next_20_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(2)')
    _get_next_50_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(3)')
    _quick_filter_locator = (By.ID, 'quick-filter')
    _result_sets_locator = (By.CSS_SELECTOR, '.result-set:not(.row)')
    _unchecked_repos_links_locator = (By.CSS_SELECTOR, '#repoLabel + .dropdown-menu .dropdown-checkbox:not([checked]) + .dropdown-link')
    _unclassified_failure_count_locator = (By.ID, 'unclassified-failure-count')
    _unclassified_failure_filter_locator = (By.CSS_SELECTOR, '.btn-unclassified-failures')

    def __init__(self, driver, base_url=None, timeout=20, **url_kwargs):
        super(TreeherderPage, self).__init__(driver, base_url, timeout, **url_kwargs)

    def wait_for_page_to_load(self):
        self.wait.until(lambda s: len(self.all_jobs) >= 1)
        return self

    @property
    def all_emails(self):
        return list(itertools.chain.from_iterable(
            r.emails for r in self.result_sets))

    @property
    def all_failed_jobs(self):
        return list(itertools.chain.from_iterable(
            r.failed_jobs for r in self.result_sets))

    @property
    def all_in_progress_jobs(self):
        return list(itertools.chain.from_iterable(
            r.in_progress_jobs for r in self.result_sets))

    @property
    def all_jobs(self):
        return list(itertools.chain.from_iterable(
            r.jobs for r in self.result_sets))

    @property
    def all_restarted_jobs(self):
        return list(itertools.chain.from_iterable(
            r.restarted_jobs for r in self.result_sets))

    @property
    def all_successful_jobs(self):
        return list(itertools.chain.from_iterable(
            r.successful_jobs for r in self.result_sets))

    @property
    def all_superseded_jobs(self):
        return list(itertools.chain.from_iterable(
            r.superseded_jobs for r in self.result_sets))

    @property
    def info_panel(self):
        return self.InfoPanel(self)

    @property
    def nav_filter_superseded_is_selected(self):
        el = self.find_element(*self._nav_filter_superseded_locator)
        return ('fa-dot-circle-o' in el.get_attribute('class'))

    @property
    def nav_filter_failures_is_selected(self):
        el = self.find_element(*self._nav_filter_failures_locator)
        return ('fa-dot-circle-o' in el.get_attribute('class'))

    @property
    def nav_filter_in_progress_is_selected(self):
        el = self.find_element(*self._nav_filter_inprogress_locator)
        return ('fa-dot-circle-o' in el.get_attribute('class'))

    @property
    def nav_filter_retry_is_selected(self):
        el = self.find_element(*self._nav_filter_retry_locator)
        return ('fa-dot-circle-o' in el.get_attribute('class'))

    @property
    def nav_filter_success_is_selected(self):
        el = self.find_element(*self._nav_filter_successes_locator)
        return ('fa-dot-circle-o' in el.get_attribute('class'))

    @property
    def nav_filter_usercancel_is_selected(self):
        el = self.find_element(*self._nav_filter_usercancel_locator)
        return ('fa-dot-circle-o' in el.get_attribute('class'))

    @property
    def pinboard(self):
        return self.Pinboard(self)

    @property
    def random_email_name(self):
        random_email_name = random.choice(self.all_emails)
        return random_email_name.get_name

    @property
    def result_sets(self):
        return [self.ResultSet(self, el) for el in self.find_elements(*self._result_sets_locator)]

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
            self.wait.until(lambda s: self.result_sets)
        elif method == 'keyboard':
            self.find_element(By.CSS_SELECTOR, 'body').send_keys(
                'f' + term + Keys.RETURN)
        else:
            raise Exception('Unsupported method: {}'.format(method))

    def filter_job_superseded(self):
        self.find_element(*self._nav_filter_superseded_locator).click()

    def filter_job_failures(self):
        self.find_element(*self._nav_filter_failures_locator).click()

    def filter_job_in_progress(self):
        self.find_element(*self._nav_filter_inprogress_locator).click()

    def filter_job_retries(self):
        self.find_element(*self._nav_filter_retry_locator).click()

    def filter_job_successes(self):
        self.find_element(*self._nav_filter_successes_locator).click()

    def filter_job_usercancel(self):
        self.find_element(*self._nav_filter_usercancel_locator).click()

    def filter_unclassified_jobs(self):
        self.find_element(*self._unclassified_failure_filter_locator).click()

    def _get_next(self, count):
        before = len(self.result_sets)
        locator = getattr(self, '_get_next_{}_locator'.format(count))
        self.find_element(*locator).click()
        self.wait.until(lambda s: len(self.result_sets) == before + count)

    def get_next_10(self):
        self._get_next(10)

    def get_next_20(self):
        self._get_next(20)

    def get_next_50(self):
        self._get_next(50)

    def open_next_unclassified_failure(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys('n')
        self.wait.until(lambda _: self.info_panel.is_open)

    def pin_using_spacebar(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys(Keys.SPACE)
        self.wait.until(lambda _: self.pinboard.is_pinboard_open)

    def select_next_job(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys(Keys.ARROW_RIGHT)

    def select_previous_job(self):
        self.find_element(By.CSS_SELECTOR, 'body').send_keys(Keys.ARROW_LEFT)

    def select_random_email(self):
        # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
        el = self.find_element(By.CSS_SELECTOR, 'body')
        random.choice(self.all_emails).click()
        self.wait.until(EC.staleness_of(el))
        self.wait_for_page_to_load()

    def select_random_job(self):
        random_job = random.choice(self.all_jobs)
        random_job.click()

    class ResultSet(Region):

        _busted_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-red')
        _datestamp_locator = (By.CSS_SELECTOR, '.result-set-title-left > span a')
        _dropdown_toggle_locator = (By.CLASS_NAME, 'dropdown-toggle')
        _email_locator = (By.CSS_SELECTOR, '.result-set-title-left > th-author > span > a')
        _exception_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-purple')
        _job_groups_locator = (By.CSS_SELECTOR, '.job-group')
        _jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown')
        _pending_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-ltgray')
        _pin_all_jobs_locator = (By.CLASS_NAME, 'pin-all-jobs-btn')
        _restarted_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-dkblue')
        _running_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-dkgray')
        _set_bottom_of_range_locator = (By.CSS_SELECTOR, 'ul.show > li:nth-child(9) > a')
        _set_top_of_range_locator = (By.CSS_SELECTOR, 'ul.show > li:nth-child(8) > a')
        _successful_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-green')
        _superseded_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-ltblue')
        _tests_failed_jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown.btn-orange')

        @property
        def busted_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._busted_jobs_locator)]

        @property
        def datestamp(self):
            return self.find_element(*self._datestamp_locator).text

        @property
        def emails(self):
            return [self.Email(self.page, root=el) for el in self.find_elements(*self._email_locator)]

        @property
        def email_name(self):
            return self.find_element(*self._email_locator).text

        @property
        def exception_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._exception_jobs_locator)]

        @property
        def failed_jobs(self):
            return self.busted_jobs + self.exception_jobs + self.tests_failed_jobs

        def contains_platform(self, value):
            locator = (By.CSS_SELECTOR, '.job-list tr[style=\'display: table-row;\'] .platform > span[title~={} i]'.format(value))
            return any(self.find_elements(*locator))

        @property
        def in_progress_jobs(self):
            return self.pending_jobs + self.running_jobs

        @property
        def job_groups(self):
            return [self.JobGroup(self.page, root=el) for el in self.find_elements(*self._job_groups_locator)]

        @property
        def jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._jobs_locator)]

        @property
        def pending_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._pending_jobs_locator)]

        def pin_all_jobs(self):
            return self.find_element(*self._pin_all_jobs_locator).click()

        @property
        def restarted_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._restarted_jobs_locator)]

        @property
        def running_jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._running_jobs_locator)]

        def set_as_bottom_of_range(self):
            # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
            el = self.page.find_element(By.CSS_SELECTOR, 'body')
            self.find_element(*self._dropdown_toggle_locator).click()
            self.find_element(*self._set_bottom_of_range_locator).click()
            self.wait.until(EC.staleness_of(el))
            self.page.wait_for_page_to_load()

        def set_as_top_of_range(self):
            # FIXME workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1411264
            el = self.page.find_element(By.CSS_SELECTOR, 'body')
            self.find_element(*self._dropdown_toggle_locator).click()
            self.find_element(*self._set_top_of_range_locator).click()
            self.wait.until(EC.staleness_of(el))
            self.page.wait_for_page_to_load()

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

        class Email(Region):

            @property
            def get_name(self):
                return self.root.text

            def click(self):
                self.root.click()

        class Job(Region):

            @property
            def in_progress(self):
                classes = self.root.get_attribute('class').split()
                return any(c in ('btn-dkgray', 'btn-ltgray') for c in classes)

            @property
            def selected(self):
                return 'selected-job' in self.root.get_attribute('class')

            @property
            def symbol(self):
                return self.root.text

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
            _pin_job_locator = (By.ID, 'pin-job-btn')

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

            def pin_job(self):
                self.find_element(*self._pin_job_locator).click()
                self.wait.until(lambda _: self.page.pinboard.is_pinboard_open)

    class Pinboard(Region):

        _root_locator = (By.ID, 'pinboard-panel')
        _clear_all_menu_locator = (By.CSS_SELECTOR, '#pinboard-controls .dropdown-menu li:nth-child(5) a')
        _jobs_locator = (By.CLASS_NAME, 'pinned-job')
        _open_save_menu_locator = (By.CSS_SELECTOR, '#pinboard-controls .save-btn-dropdown')
        _pinboard_remove_job_locator = (By.CSS_SELECTOR, '#pinned-job-list .pinned-job-close-btn')

        @property
        def is_pinboard_open(self):
            return self.root.is_displayed()

        @property
        def jobs(self):
            return [self.Job(self.page, el) for el in self.find_elements(*self._jobs_locator)]

        @property
        def selected_job(self):
            return next(j for j in self.jobs if j.is_selected)

        def clear_pinboard(self):
            el = self.find_element(*self._open_save_menu_locator)
            el.click()
            self.wait.until(lambda _: el.get_attribute('aria-expanded') == 'true')
            self.find_element(*self._clear_all_menu_locator).click()

        class Job(Region):

            @property
            def is_selected(self):
                return 'selected-job' in self.root.get_attribute('class')

            @property
            def symbol(self):
                return self.root.text


class LogviewerPage(Page):

    _job_header_locator = (By.CSS_SELECTOR, 'div.job-header')

    def wait_for_page_to_load(self):
        self.wait.until(lambda s: self.is_job_status_visible)
        return self

    @property
    def is_job_status_visible(self):
        return self.is_element_displayed(*self._job_header_locator)
