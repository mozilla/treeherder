import itertools

from pypom import Page, Region
from selenium.webdriver.common.by import By


class TreeherderPage(Page):

    _get_next_10_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(1)')
    _get_next_20_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(2)')
    _get_next_50_locator = (By.CSS_SELECTOR, 'div.btn:nth-child(3)')
    _pushes_locator = (By.CSS_SELECTOR, '.push:not(.row)')

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
    def pushes(self):
        return [self.ResultSet(self, el) for el in self.find_elements(*self._pushes_locator)]

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

    class ResultSet(Region):

        _jobs_locator = (By.CSS_SELECTOR, '.job-btn.filter-shown')

        @property
        def jobs(self):
            return [self.Job(self.page, root=el) for el in self.find_elements(*self._jobs_locator)]

        class Job(Region):
            pass
