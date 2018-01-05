from pages.treeherder import Treeherder


def test_filter_jobs_by_keywords(base_url, selenium, test_job_2):
    page = Treeherder(selenium, base_url).open()
    assert len(page.all_jobs) == 2
    page.all_jobs[0].click()
    keywords = page.info_panel.job_details.keywords
    page.info_panel.job_details.filter_by_keywords()
    assert len(page.all_jobs) == 1
    assert page.quick_filter_term == keywords.lower()
