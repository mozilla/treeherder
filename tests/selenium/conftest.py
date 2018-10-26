import os

import pytest
from django.conf import settings


@pytest.fixture(scope="session")
def base_url(live_server):
    if not os.path.exists(settings.WHITENOISE_ROOT):
        pytest.skip(
            'Skipping Selenium tests since built UI not found (generate it using `yarn build`).'
        )
    return live_server.url


@pytest.fixture(scope='session')
def sensitive_url(request, base_url):
    pass
