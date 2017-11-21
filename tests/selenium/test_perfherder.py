from pages.perfherder import Perfherder


def test_add_test_data(base_url, selenium):
    '''This tests that we can click the add test data button'''
    page = Perfherder(selenium, base_url).open()
    page.add_test_data()
    # FIXME: Add more coverage.
