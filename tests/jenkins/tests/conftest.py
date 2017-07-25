import pytest


@pytest.fixture
def capabilities(request, capabilities):
    driver = request.config.getoption('driver')
    if capabilities.get('browserName', driver).lower() == 'firefox':
        capabilities['marionette'] = True
    return capabilities

    
@pytest.fixture(scope='session')
def session_capabilities(session_capabilities):
    session_capabilities.setdefault('tags', []).append('treeherder')
    return session_capabilities


@pytest.fixture
def selenium(selenium):
    selenium.maximize_window()
    return selenium
