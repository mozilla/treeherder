import os

from django.core.exceptions import ImproperlyConfigured
from django.utils.functional import Promise
from kombu import Connection
from pytest import raises

from treeherder.services.pulse.connection import (build_connection,
                                                  pulse_conn)


def test_build_connection():
    os.environ["PULSE_URL"] = "amqp://guest:guest@pulse.mozilla.org/"
    conn = build_connection()
    del os.environ["PULSE_URL"]

    assert isinstance(conn, Connection)


def test_pulse_conn_is_lazy():
    """
    Confirm pulse_conn is a lazy object.

    With no PULSE_URL set this should fail with a ImproperlyConfigured when the
    wrapped build_connection is called and tries to access it in the env
    """
    assert isinstance(pulse_conn, Promise)

    with raises(ImproperlyConfigured):
        # Django's lazy function requires we access a wrapped object to trigger
        # running it.  Assigning it to a variable is not enough.
        print(pulse_conn)
