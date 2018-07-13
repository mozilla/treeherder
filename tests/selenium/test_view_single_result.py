from pages.treeherder import Treeherder


def test_open_single_result(base_url, selenium, test_commit):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: 1 == len(page.pushes))
    page.pushes[0].view()
    page.wait.until(lambda _: len(page.pushes))
    assert 1 == len(page.pushes)
    assert test_commit.author == page.pushes[0].author
    assert test_commit.push.time.strftime('%a, %b %-d, %H:%M:%S') == page.pushes[0].datestamp
    assert 1 == len(page.pushes[0].commits)
    assert test_commit.revision[:12] == page.pushes[0].commits[0].revision
    assert test_commit.comments == page.pushes[0].commits[0].comment
