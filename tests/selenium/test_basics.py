import datetime

import pytest
from django.core.management import call_command
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from treeherder.model.models import (Commit,
                                     Push,
                                     Repository)

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
        EC.visibility_of_element_located((By.ID, 'repoLabel'))
    )
    repo_button.click()
    assert selenium.find_element_by_id('repo-dropdown').is_displayed()


def test_perfherder_main(initial_data, live_server, selenium):
    '''
    This tests that the basic graphs view load and we can click the add tests button
    '''
    selenium.get(live_server.url + '/perf.html')
    add_test_button = WebDriverWait(selenium, 20).until(
        EC.visibility_of_element_located((By.ID, 'add-test-data-button'))
    )
    add_test_button.click()
    WebDriverWait(selenium, 20).until(
        EC.presence_of_element_located((By.ID, 'performance-test-chooser'))
    )


def test_treeherder_single_commit_titles(initial_data, live_server, selenium):
    '''
    This tests that page titles are correct
    '''
    push = Push.objects.create(repository=Repository.objects.get(name='mozilla-central'),
                               revision="4c45a777949168d16c03a4cba167678b7ab65f76",
                               author="foo@bar.com",
                               time=datetime.datetime.now())

    Commit.objects.create(push=push,
                          revision="4c45a777949168d16c03a4cba167678b7ab65f76",
                          author="foo@bar.com",
                          comments="Bug 12345 - This is a message")

    selenium.get(live_server.url + '/#/jobs?repo=mozilla-central&revision=4c45a777949168d16c03a4cba167678b7ab65f76')

    WebDriverWait(selenium, 30).until(
        EC.visibility_of_element_located((By.CLASS_NAME, 'revision-comment'))
    )
    assert selenium.title == "[0] mozilla-central: Bug 12345 - This is a message"
