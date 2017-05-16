from pages.treeherder import TreeherderPage


def test_pin_job(base_url, selenium):
    """Open treeherder page, select first job and pin it"""
    page = TreeherderPage(selenium, base_url).open()
    job = page.result_sets[0].jobs[0]
    job.click()
    assert 0 == len(page.pinboard.jobs)
    page.pin_using_spacebar()
    assert 1 == len(page.pinboard.jobs)
    assert job.symbol == page.pinboard.selected_job.symbol


def test_pin_job_from_job_details(base_url, selenium):
    """Open treeherder page, select first job, pin it by the pin icon"""
    page = TreeherderPage(selenium, base_url).open()
    job = page.result_sets[0].jobs[0]
    job.click()
    assert 0 == len(page.pinboard.jobs)
    page.info_panel.job_details.pin_job()
    assert 1 == len(page.pinboard.jobs)
    assert job.symbol == page.pinboard.selected_job.symbol


def test_clear_pinboard(base_url, selenium):
    """Open treeherder page, pin a job and then clear the pinboard"""
    page = TreeherderPage(selenium, base_url).open()
    page.result_sets[0].jobs[0].click()
    page.pin_using_spacebar()
    assert 1 == len(page.pinboard.jobs)
    page.pinboard.clear_pinboard()
    assert page.pinboard.is_pinboard_open
    assert 0 == len(page.pinboard.jobs)


def test_pin_all_jobs(base_url, selenium):
    """Open treeherder page, pin all jobs, confirm no more than 500 pins in pinboard"""
    page = TreeherderPage(selenium, base_url).open()
    page.result_sets[0].pin_all_jobs()
    assert 0 < len(page.pinboard.jobs) <= 500
