import pytest


@pytest.fixture(scope='session')
def session_capabilities(session_capabilities):
    session_capabilities.setdefault('tags', []).append('treeherder')
    return session_capabilities


@pytest.fixture
def selenium(selenium):
    selenium.maximize_window()
    return selenium
