from pages.treeherder import Treeherder


def test_open_single_result(base_url, selenium, test_commit):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: 1 == len(page.result_sets))
    page.result_sets[0].view()
    assert 1 == len(page.result_sets)
    assert test_commit.author == page.result_sets[0].author
    assert test_commit.push.time.strftime('%a %b %-d, %H:%M:%S') == page.result_sets[0].datestamp
    assert 1 == len(page.result_sets[0].commits)
    assert test_commit.revision[:12] == page.result_sets[0].commits[0].revision
    assert test_commit.comments == page.result_sets[0].commits[0].comment
