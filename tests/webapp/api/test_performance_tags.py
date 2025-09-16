import pytest
from django.urls import reverse

pytestmark = pytest.mark.perf


def test_perf_tags_get(authorized_sheriff_client, test_perf_tag, test_perf_tag_2):
    resp = authorized_sheriff_client.get(reverse("performance-tags-list"))
    assert resp.status_code == 200

    assert len(resp.json()) == 2

    assert resp.json()[0]["id"] == test_perf_tag.id
    assert resp.json()[0]["name"] == test_perf_tag.name

    assert resp.json()[1]["id"] == test_perf_tag_2.id
    assert resp.json()[1]["name"] == test_perf_tag_2.name
