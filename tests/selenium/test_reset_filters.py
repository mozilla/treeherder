from pages.treeherder import Treeherder


def test_reset_filters(base_url, selenium, test_job):
    page = Treeherder(selenium, base_url).open()
    with page.filters_menu() as filters:
        getattr(filters, 'toggle_{}_jobs'.format(test_job.result))()
    assert len(page.all_jobs) == 0
    page.reset_filters()
    assert len(page.all_jobs) == 1
