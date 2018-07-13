from pages.treeherder import Treeherder


def test_set_as_top_of_range(base_url, selenium, test_job):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: page.all_jobs)
    pushes = page.pushes
    datestamp = pushes[1].datestamp
    assert pushes[0].datestamp != datestamp
    pushes[1].set_as_top_of_range()
    page.wait.until(lambda _: len(page.pushes))
    assert page.pushes[0].datestamp == datestamp


def test_set_as_bottom_of_range(base_url, selenium, test_job):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: page.all_jobs)
    pushes = page.pushes
    datestamp = pushes[-2].datestamp
    assert pushes[-1].datestamp != datestamp
    page.pushes[-2].set_as_bottom_of_range()
    page.wait.until(lambda _: len(page.pushes))
    assert page.pushes[-1].datestamp == datestamp
