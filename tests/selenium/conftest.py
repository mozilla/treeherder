import pytest
from django.core.management import call_command


@pytest.fixture(scope="session")
def base_url(live_server):
    return live_server.url


@pytest.fixture(scope='session')
def sensitive_url(request, base_url):
    pass


@pytest.fixture(autouse=True)
def initial_data(transactional_db):
    call_command('load_initial_data')
