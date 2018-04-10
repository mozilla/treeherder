import copy

import pytest

from pages.treeherder import Treeherder


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    job_blobs = []
    for i in range(len(eleven_job_blobs)):
        job = copy.deepcopy(eleven_job_blobs[0])
        job['job'].update({
            'job_guid': eleven_job_blobs[i]['job']['job_guid'],
            'job_symbol': 'job{}'.format(i)})
        job_blobs.append(job)
    return create_jobs(job_blobs)


@pytest.mark.parametrize('method', [('keyboard'), ('pointer')])
def test_pin_job(base_url, selenium, test_jobs, method):
    page = Treeherder(selenium, base_url).open()
    page.all_jobs[0].click()
    assert len(page.pinboard.jobs) == 0
    page.info_panel.job_details.pin_job(method)
    assert len(page.pinboard.jobs) == 1
    assert page.pinboard.jobs[0].symbol == page.all_jobs[0].symbol


def test_clear_pinboard(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.all_jobs[0].click()
    page.info_panel.job_details.pin_job()
    assert len(page.pinboard.jobs) == 1
    page.pinboard.clear()
    assert len(page.pinboard.jobs) == 0


def test_pin_all_jobs(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    push = next(p for p in page.pushes if len(p.jobs) > 1)
    push.pin_all_jobs()
    assert len(page.pinboard.jobs) == len(test_jobs)
