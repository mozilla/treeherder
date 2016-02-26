import pytest
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient


def test_job_list(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
    """
    resp = webapp.get(
        reverse("jobs-list",
                kwargs={"project": jm.project})
    )
    assert resp.status_int == 200
    response_dict = resp.json
    jobs = response_dict["results"]
    assert isinstance(jobs, list)
    assert len(jobs) == 10
    exp_keys = [
        "submit_timestamp",
        "start_timestamp",
        "result_set_id",
        "who",
        "option_collection_hash",
        "reason",
        "id",
        "job_guid",
        "state",
        "result",
        "build_platform_id",
        "job_coalesced_to_guid",
        "end_timestamp",
        "build_platform",
        "machine_name",
        "job_group_id",
        "job_group_symbol",
        "job_group_name",
        "job_type_id",
        "job_type_name",
        "job_type_description",
        "build_architecture",
        "build_system_type",
        "job_type_symbol",
        "platform",
        "job_group_description",
        "platform_option",
        "machine_platform_os",
        "build_os",
        "machine_platform_architecture",
        "failure_classification_id",
        "running_eta",
        "tier",
        "last_modified",
        "ref_data_name",
        "signature"
    ]
    for job in jobs:
        assert set(job.keys()) == set(exp_keys)


def test_job_list_bad_project(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a job list with a bad project throws 404.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    badurl = url.replace(jm.project, "badproject")

    webapp.get(badurl, status=404)


def test_job_list_equals_filter(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a job list with a querystring filter.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    final_url = url + "?job_guid=f1c75261017c7c5ce3000931dce4c442fe0a1297"

    resp = webapp.get(final_url).json

    assert len(resp['results']) == 1


job_filter_values = [
 (u'build_architecture', u'x86_64'),
 (u'build_os', u'mac'),
 (u'build_platform', u'osx-10-7'),
 (u'build_platform_id', 3),
 (u'build_system_type', u'buildbot'),
 (u'end_timestamp', 1384364849),
 (u'failure_classification_id', 1),
 (u'id', 4),
 (u'job_coalesced_to_guid', u'5da36fb825bc52d13fed5b805d44015b0f2f2f16'),
 (u'job_group_id', 2),
 (u'job_group_name', u'Mochitest'),
 (u'job_group_symbol', u'M'),
 (u'job_guid', u'ab952a4bbbc74f1d9fb3cf536073b371029dbd02'),
 (u'job_type_id', 2),
 (u'job_type_name', u'Mochitest Browser Chrome'),
 (u'job_type_symbol', u'bc'),
 (u'machine_name', u'talos-r4-lion-011'),
 (u'machine_platform_architecture', u'x86_64'),
 (u'machine_platform_os', u'mac'),
 (u'option_collection_hash', u'32faaecac742100f7753f0c1d0aa0add01b4046b'),
 (u'platform', u'osx-10-7'),
 (u'reason', u'scheduler'),
 (u'ref_data_name', u'1f2ea1934af0731400c4a5ab831e0c5ec287f0ad'),
 (u'result', u'success'),
 (u'result_set_id', 4),
 (u'signature', u'1f2ea1934af0731400c4a5ab831e0c5ec287f0ad'),
 (u'start_timestamp', 1384356880),
 (u'state', u'completed'),
 (u'submit_timestamp', 1384356854),
 (u'tier', 1),
 (u'who', u'tests-mozilla-b2g26_v1_2-lion-debug-unittest')
 ]


@pytest.mark.parametrize(('fieldname', 'expected'), job_filter_values)
def test_job_list_filter_fields(webapp, eleven_jobs_stored, jm, fieldname, expected):
    """
    test retrieving a job list with a querystring filter.

    values chosen above are from the 3rd of the ``eleven_stored_jobs`` so that
    we aren't just getting the first one every time.

    The field of ``last_modified`` is auto-generated, so just skipping that
    to make this test easy.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    final_url = url + "?{}={}".format(fieldname, expected)
    print final_url
    resp = webapp.get(final_url).json
    first = resp['results'][0]

    assert first[fieldname] == expected


def test_job_list_in_filter(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a job list with a querystring filter.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    final_url = url + ("?job_guid__in="
                       "f1c75261017c7c5ce3000931dce4c442fe0a1297,"
                       "9abb6f7d54a49d763c584926377f09835c5e1a32")

    resp = webapp.get(final_url).json
    assert len(resp['results']) == 2


def test_job_detail(webapp, eleven_jobs_stored, sample_artifacts, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1)[0]

    resp = webapp.get(
        reverse("jobs-detail",
                kwargs={"project": jm.project, "pk": job["id"]})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == job["id"]

    jm.disconnect()


def test_job_retrigger_unauthorized(webapp, eleven_jobs_stored, jm):
    """
    Validate that only authenticated users can hit this endpoint.
    """
    job = jm.get_job_list(0, 1)[0]
    job_id_list = [job["id"]]
    url = reverse("jobs-retrigger",
                  kwargs={"project": jm.project})
    webapp.post(url, {"job_id_list": job_id_list}, status=403)


def test_job_retrigger_authorized(webapp, eleven_jobs_stored, jm,
                                  pulse_action_consumer):
    """
    Validate that only authenticated users can hit this endpoint.
    """
    client = APIClient()
    email = "foo-retrigger@example.com"
    user = User.objects.create(username="retrigger-fail", email=email)
    client.force_authenticate(user=user)

    job = jm.get_job_list(0, 1)[0]
    job_id_list = [job["id"]]
    url = reverse("jobs-retrigger",
                  kwargs={"project": jm.project})
    client.post(url, {"job_id_list": job_id_list}, format='json')

    message = pulse_action_consumer.get(block=True, timeout=2)
    content = message.payload

    assert content['project'] == jm.project
    assert content['action'] == 'retrigger'
    assert content['job_guid'] == job['job_guid']
    assert content['requester'] == email
    user.delete()


def test_job_cancel_authorized(webapp, eleven_jobs_stored, jm,
                               pulse_action_consumer):
    """
    Validate that only authenticated users can hit this endpoint.
    """
    client = APIClient()
    email = "cancel@example.com"
    user = User.objects.create(username="retrigger", email=email)
    client.force_authenticate(user=user)

    job = jm.get_job_list(0, 1)[0]
    url = reverse("jobs-cancel",
                  kwargs={"project": jm.project, "pk": job["id"]})
    client.post(url)

    message = pulse_action_consumer.get(block=True, timeout=2)
    content = message.payload

    assert content['project'] == jm.project
    assert content['action'] == 'cancel'
    assert content['job_guid'] == job['job_guid']
    assert content['requester'] == email
    user.delete()


def test_job_detail_bad_project(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1)[0]
    url = reverse("jobs-detail",
                  kwargs={"project": jm.project, "pk": job["id"]})
    badurl = url.replace(jm.project, "badproject")

    webapp.get(badurl, status=404)

    jm.disconnect()


def test_job_detail_not_found(webapp, jm):
    """
    test retrieving a HTTP 404 from the jobs-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("jobs-detail",
                kwargs={"project": jm.project, "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404


@pytest.mark.skipif(True, reason="Awaiting landing of Bug 1177519")
def test_job_error_lines(webapp, eleven_jobs_stored, jm, failure_lines, classified_failures):
    """
    test retrieving failure lines
    """
    job = jm.get_job(1)[0]

    resp = webapp.get(
        reverse("jobs-failure-lines",
                kwargs={"project": jm.project, "pk": job["id"]})
    )
    assert resp.status_int == 200

    failures = resp.json
    assert isinstance(failures, list)

    exp_failure_keys = ["id", "job_guid", "repository", "action", "line",
                        "test", "subtest", "status", "expected", "message",
                        "signature", "level", "created", "modified", "matches"]

    assert set(failures[0].keys()) == set(exp_failure_keys)

    matches = failures[0]["matches"]
    assert isinstance(matches, list)

    exp_matches_keys = ["id", "matcher", "score", "is_best", "classified_failure"]

    assert set(matches[0].keys()) == set(exp_matches_keys)

    classified = matches[0]["classified_failure"]
    assert isinstance(classified, dict)

    exp_classified_keys = ["id", "bug_number"]

    assert set(classified.keys()) == set(exp_classified_keys)

    jm.disconnect()


def test_list_similar_jobs(webapp, eleven_jobs_stored, jm):
    """
    test retrieving similar jobs
    """
    job = jm.get_job(1)[0]

    resp = webapp.get(
        reverse("jobs-similar-jobs",
                kwargs={"project": jm.project, "pk": job["id"]})
    )
    assert resp.status_int == 200

    similar_jobs = resp.json

    assert 'results' in similar_jobs

    assert isinstance(similar_jobs['results'], list)

    assert len(similar_jobs['results']) == 3
