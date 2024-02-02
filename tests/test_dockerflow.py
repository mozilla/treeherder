import json
import pytest

from django.conf import settings


@pytest.mark.django_db
def test_get_version(client):
    response = client.get("/__version__")
    assert response.status_code == 200

    with open(f"{settings.BASE_DIR}/version.json") as version_file:
        assert response.json() == json.loads(version_file.read())


@pytest.mark.django_db
def test_get_heartbeat_debug(client):
    settings.DEBUG = True

    response = client.get("/__heartbeat__")
    assert response.status_code == 200

    # In DEBUG mode, we can retrieve checks details
    heartbeat = response.json()
    assert heartbeat["status"] == "ok"
    assert "checks" in heartbeat
    assert "details" in heartbeat


@pytest.mark.django_db
def test_get_heartbeat(client):
    settings.DEBUG = False

    response = client.get("/__heartbeat__")
    assert response.status_code == 200

    # When DEBUG is False, we can't retrieve checks details and the status is certainly
    # equal to "warning" because of the deployment checks that are added:
    # https://github.com/mozilla-services/python-dockerflow/blob/e316f0c5f0aa6d176a6d08d1f568f83658b51339/src/dockerflow/django/views.py#L45
    assert response.json() == {"status": "warning"}


@pytest.mark.django_db
def test_get_lbheartbeat(client):
    response = client.get("/__lbheartbeat__")
    assert response.status_code == 200
    assert not response.content
