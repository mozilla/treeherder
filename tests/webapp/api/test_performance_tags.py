import pytest
from django.urls import reverse

pytestmark = pytest.mark.perf


def test_perf_tags_get(authorized_sheriff_client, test_perf_tag, test_perf_tag_2):
    resp = authorized_sheriff_client.get(reverse("performance-tags-list"))
    assert resp.status_code == 200

    tags = {tag["id"]: tag["name"] for tag in resp.json()}
    assert tags[test_perf_tag.id] == test_perf_tag.name
    assert tags[test_perf_tag_2.id] == test_perf_tag_2.name
