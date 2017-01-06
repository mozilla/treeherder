import MySQLdb
import pytest
from _mysql_exceptions import OperationalError
from celery import current_app
from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command


def test_mysqlclient_tls_enforced():
    """
    Test that if a CA certificate is specified, the connection won't fall back to
    plaintext, if the server doesn't support TLS (or if a MITM attacker strips it).

    If mysqlclient has been compiled against a vulnerable version of libmysqlclient
    then this test will fail. There is overlap between this and our custom Django system
    check for ensuring mysqlclient has been compiled against libmysqlclient >= 5.7.11,
    however there advantages in having both:
      * the system check is run during deploy, unlike this test
      * however this test is more thorough since it actually checks TLS behaviour and not
        just version numbers (but this method cannot be used in the system check run
        during production deployment, since it relies on having a MySQL server instance
        that doesn't support TLS, to emulate the TLS being stripped by an attacker)
    """
    db_config = settings.DATABASES['default']
    with pytest.raises(OperationalError) as e:
        MySQLdb.connect(
            host=db_config['HOST'],
            user=db_config['USER'],
            passwd=db_config.get('PASSWORD') or '',
            ssl={
                'ca': 'foo/bar.pem',
            }
        )
    assert "SSL connection error" in str(e.value)


@pytest.mark.django_db
def test_no_missing_migrations():
    """Check no model changes have been made since the last `./manage.py makemigrations`."""
    with pytest.raises(SystemExit) as e:
        # Replace with `check_changes=True` once we're using Django 1.10:
        # https://code.djangoproject.com/ticket/25604
        # https://github.com/django/django/pull/5453
        call_command('makemigrations', interactive=False, dry_run=True, exit_code=True)
    assert str(e.value) == '1'


def test_memcached_setup():
    "Test memcached is properly setup"
    k, v = 'my_key', 'my_value'
    cache.set(k, v)
    assert cache.get(k) == v


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
