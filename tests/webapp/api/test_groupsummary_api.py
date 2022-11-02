import datetime
from django.urls import reverse


# test date (future date, no data)
def test_future_date(group_data, client):
    expected = [{"manifest": "/test", "results": []}]

    today = datetime.datetime.today().date()
    tomorrow = today + datetime.timedelta(days=1)
    url = reverse('groupsummary') + "?date=%s&manifest=/test" % tomorrow
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == expected


# test date (today/recent) data
def test_default_date(group_data, client):
    expected = [{"manifest": "/test", "results": []}]

    url = reverse('groupsummary') + "?manifest=/test"
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == expected


# test manifests missing, blank, no '/', single string, commas
def test_invalid_manifest(group_data, client):
    expected = "invalid url query parameter manifest: 'asdf'"

    resp = client.get(reverse('groupsummary') + "?manifest=asdf")
    assert resp.status_code == 400
    assert resp.json() == expected


def test_manifest_blank(group_data, client):
    expected = "invalid url query parameter manifest: ''"

    resp = client.get(reverse('groupsummary') + "?manifest=")
    assert resp.status_code == 400
    assert resp.json() == expected


def test_missing_manifest(group_data, client):
    expected = "invalid url query parameter manifest: None"

    resp = client.get(reverse('groupsummary') + "")
    assert resp.status_code == 400
    assert resp.json() == expected


# test data, summarized by manifest
# test jobname chunk removal and aggregation
def test_summarized(group_data, client):
    expected = group_data['expected']
    url = (
        reverse('groupsummary') + "?manifest=/test&date=%s" % str(group_data['date']).split(' ')[0]
    )
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == expected
