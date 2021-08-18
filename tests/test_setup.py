import pytest
import responses
from celery import current_app
from django.core.cache import cache
from django.core.management import call_command

from treeherder.config.utils import get_tls_redis_url
from treeherder.utils.http import fetch_text


def test_block_unmocked_requests():
    """Ensure the `block_unmocked_requests` fixture prevents requests from hitting the network."""
    url = 'https://example.com'

    with pytest.raises(RuntimeError, match='Tests must mock all HTTP requests!'):
        fetch_text(url)

    with responses.RequestsMock() as rsps:
        rsps.add(responses.GET, url, body='Mocked requests still work')
        text = fetch_text(url)
        assert text == 'Mocked requests still work'


@pytest.mark.django_db
def test_no_missing_migrations():
    """Check no model changes have been made since the last `./manage.py makemigrations`."""
    call_command('makemigrations', interactive=False, dry_run=True, check_changes=True)


def test_django_cache():
    """Test the Django cache backend & associated server are properly set up."""
    k, v = 'my_key', 'my_value'
    cache.set(k, v, 10)
    assert cache.get(k) == v


def test_get_tls_redis_url():
    """
    Test conversion from REDIS_URL to the stunnel TLS URL described here:
    https://devcenter.heroku.com/articles/securing-heroku-redis#connecting-directly-to-stunnel
    """
    REDIS_URL = 'redis://h:abc8069@ec2-12-34-56-78.compute-1.amazonaws.com:8069'
    TLS_REDIS_URL = (
        'rediss://h:abc8069@ec2-12-34-56-78.compute-1.amazonaws.com:8070?ssl_cert_reqs=none'
    )
    assert get_tls_redis_url(REDIS_URL) == TLS_REDIS_URL


@current_app.task
def add(x, y):
    return x + y


def test_celery_setup():
    "Test celery executes a task properly"

    result = add.delay(7, 3)
    assert result.wait() == 10


@pytest.mark.django_db(transaction=True)
def test_load_initial_data():
    "Test load_initial_data executes properly"

    call_command('load_initial_data')
