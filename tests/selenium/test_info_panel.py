import pytest

from pages.treeherder import Treeherder


@pytest.mark.parametrize('method', [('keyboard'), ('pointer')])
def test_close_info_panel(base_url, selenium, test_job, method):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: page.all_jobs)
    page.all_jobs[0].click()
    assert page.info_panel.is_open
    page.info_panel.close(method)
    assert not page.info_panel.is_open
