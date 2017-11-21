import datetime

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from treeherder.model.models import (Commit,
                                     Push,
                                     Repository)


def test_treeherder_single_commit_titles(live_server, selenium):
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
