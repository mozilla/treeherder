
from pages.perfherder_compare import PerfherderCompare


def test_compare_view(base_url, selenium, test_perf_data):
    ''' This tests that we can select a compare set '''
    compare_page = PerfherderCompare(selenium, base_url).open()

    compare_page.select_original_project("test_treeherder_jobs")
    compare_page.select_new_project("test_treeherder_jobs")
    compare_page.select_new_revision("9d54ce168c99 Gaia Pushbot <release+gaiajson@mozilla.com>")

    assert compare_page.is_compare_button_clickable()

    compare_page.click_compare_button()
