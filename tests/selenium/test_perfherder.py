import pytest

from pages.perfherder import Perfherder


@pytest.mark.skip(reason="Needs to be updated to work with react or replaced with react-testing-library")
def test_add_test_data(base_url, selenium):
    '''This tests that we can click the add test data button'''
    page = Perfherder(selenium, base_url).open()
    page.add_test_data()


@pytest.mark.skip(reason="Needs to be updated to work with react or replaced with react-testing-library")
def test_load_test_data(base_url, selenium, test_perf_data):
    """
    Test that user is able to select test data from the "test chooser" and
    the correct test data is displayed
    """

    test_data = test_perf_data.first()

    perf_page = Perfherder(selenium, base_url).open()
    select_test_modal = perf_page.add_test_data()

    select_test_modal.select_test(test_data)

    # We expect to see a signature in our series list to the side after selecting
    # it in the chooser
    test_signatures = perf_page.series_list()

    assert len(test_signatures) == 1
    assert test_signatures[0].test_name_text == "%s %s %s %s" % (test_data.signature.suite,
                                                                 test_data.signature.test,
                                                                 test_data.signature.extra_options.split(' ')[1],
                                                                 test_data.signature.extra_options.split(' ')[0])

    assert test_signatures[0].project_name_text == test_data.repository.name
    assert test_signatures[0].platform_text == test_data.signature.platform.platform
    assert test_signatures[0].signature_text == test_data.signature.signature_hash


@pytest.mark.skip(reason="Test started failing after updating mozlog, but still fails after revert.")
def test_verify_graph_tool_tip(base_url, selenium, test_perf_data):
    """Test graph tooltip information is according to test data"""

    test_data = test_perf_data.first()
    perf_page = Perfherder(selenium, base_url)
    perf_page.driver.get("%s/perf.html#/graphs?timerange=31536000"
                         "&series=test_treeherder_jobs,1,1,1"
                         "&selected=test_treeherder_jobs,1,1,1,1" % base_url)

    tool_tip = perf_page.tool_tip
    tool_tip.wait_for_region_to_load()

    assert tool_tip.is_tooltip_visible
    assert tool_tip.series_text == "%s (%s)" % (test_data.signature.test, test_data.repository.name)
    assert tool_tip.platform_text == test_data.signature.platform.platform
