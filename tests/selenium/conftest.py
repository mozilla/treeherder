import pytest


@pytest.fixture(scope="session")
def base_url(live_server):
    return live_server.url


@pytest.fixture(scope='session')
def sensitive_url(request, base_url):
    pass
