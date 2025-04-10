import datetime

from django.urls import reverse


# test date (future date, no data)
def test_future_date(group_data, client):
    expected = {"job_type_names": [], "manifests": []}

    today = datetime.datetime.today().date()
    tomorrow = today + datetime.timedelta(days=1)
    url = reverse("groupsummary") + f"?startdate={tomorrow}"
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == expected


# test date (today/recent) data
def test_default_date(group_data, client):
    expected = {"job_type_names": [], "manifests": []}

    url = reverse("groupsummary")
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == expected


# test data, summarized by manifest
# test jobname chunk removal and aggregation
def test_summarized(group_data, client):
    expected = group_data["expected"]
    startdate = str(group_data["query_string"]).split("=")[-1]
    url = reverse("groupsummary") + f"?startdate={startdate}"
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == expected
