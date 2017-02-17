import pytest
from django.core.management import call_command
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

pytestmark = pytest.mark.selenium


@pytest.fixture
def initial_data(transactional_db):
    call_command('load_initial_data')


def test_treeherder_main(initial_data, live_server, selenium):
    '''
    Tests that the default treeherder page loads ok and we can
    click the repository menu
    '''
    selenium.get(live_server.url)
    repo_button = WebDriverWait(selenium, 10).until(
        EC.presence_of_element_located((By.ID, 'repoLabel'))
    )
    repo_button.click()
    assert selenium.find_element_by_id('repo-dropdown').is_displayed()


def test_perfherder_main(initial_data, live_server, selenium):
    '''
    This tests that the basic graphs view load and we can click the add tests button
    '''
    selenium.get(live_server.url + '/perf.html')
    add_test_button = WebDriverWait(selenium, 10).until(
        EC.presence_of_element_located((By.ID, 'add-test-data-button'))
    )
    add_test_button.click()
    WebDriverWait(selenium, 10).until(
        EC.presence_of_element_located((By.ID, 'performance-test-chooser'))
    )
