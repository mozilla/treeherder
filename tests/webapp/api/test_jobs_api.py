import datetime

import pytest
from dateutil import parser
from django.core.urlresolvers import reverse
from rest_framework.status import HTTP_400_BAD_REQUEST
from rest_framework.test import APIClient

from treeherder.model.models import (ExclusionProfile,
                                     Job,
                                     JobExclusion,
                                     TextLogError,
                                     TextLogStep)
from treeherder.webapp.api.jobs import JobsViewSet


@pytest.mark.parametrize(('offset', 'count', 'expected_num'),
                         [(None, None, 10),
                          (None, 5, 5),
                          (5, None, 6),
                          (0, 5, 5),
                          (10, 10, 1)])
def test_job_list(webapp, eleven_jobs_stored, test_repository,
                  offset, count, expected_num):
    """
    test retrieving a list of json blobs from the jobs-list
    endpoint.
    """
    url = reverse("jobs-list",
                  kwargs={"project": test_repository.name})
    params = '&'.join(['{}={}'.format(k, v) for k, v in
                       [('offset', offset), ('count', count)] if v])
    if params:
        url += '?{}'.format(params)
    resp = webapp.get(url)
    assert resp.status_int == 200
    response_dict = resp.json
    jobs = response_dict["results"]
    assert isinstance(jobs, list)
    assert len(jobs) == expected_num
    exp_keys = [
        "submit_timestamp",
        "start_timestamp",
        "push_id",
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


def test_job_list_bad_project(webapp, transactional_db):
    """
    test retrieving a job list with a bad project throws 404.
    """
    badurl = reverse("jobs-list",
                     kwargs={"project": "badproject"})

    webapp.get(badurl, status=404)


def test_job_list_equals_filter(webapp, eleven_jobs_stored, test_repository):
    """
    test retrieving a job list with a querystring filter.
    """
    url = reverse("jobs-list",
                  kwargs={"project": test_repository.name})
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
 (u'ref_data_name', u'58cab069cf08211159774de948094dd963fb9d44'),
 (u'result', u'success'),
 (u'result_set_id', 4),
 (u'signature', u'58cab069cf08211159774de948094dd963fb9d44'),
 (u'start_timestamp', 1384356880),
 (u'state', u'completed'),
 (u'submit_timestamp', 1384356854),
 (u'tier', 1),
 (u'who', u'tests-mozilla-b2g26_v1_2-lion-debug-unittest')
 ]


@pytest.mark.parametrize(('fieldname', 'expected'), job_filter_values)
def test_job_list_filter_fields(webapp, eleven_jobs_stored, test_repository, fieldname, expected):
    """
    test retrieving a job list with a querystring filter.

    values chosen above are from the 3rd of the ``eleven_stored_jobs`` so that
    we aren't just getting the first one every time.

    The field of ``last_modified`` is auto-generated, so just skipping that
    to make this test easy.
    """
    url = reverse("jobs-list",
                  kwargs={"project": test_repository.name})
    final_url = url + "?{}={}".format(fieldname, expected)
    print(final_url)
    resp = webapp.get(final_url).json
    first = resp['results'][0]

    assert first[fieldname] == expected


def test_job_list_in_filter(webapp, eleven_jobs_stored, test_repository):
    """
    test retrieving a job list with a querystring filter.
    """
    url = reverse("jobs-list",
                  kwargs={"project": test_repository.name})
    final_url = url + ("?job_guid__in="
                       "f1c75261017c7c5ce3000931dce4c442fe0a1297,"
                       "9abb6f7d54a49d763c584926377f09835c5e1a32")

    resp = webapp.get(final_url).json
    assert len(resp['results']) == 2


def test_job_list_excluded(webapp, eleven_jobs_stored, sample_data,
                           test_repository, test_sheriff):
    """
    retrieve a job list of only jobs excluded by specified profile
    """
    job = sample_data.job_data[1]
    platform = job["job"]["machine_platform"]["platform"]
    arch = job["job"]["machine_platform"]["architecture"]

    job_exclusion = JobExclusion.objects.create(
        name="jobex",
        info={
            "platforms": ["{} ({})".format(platform, arch)],
            "repos": [test_repository.name],
            "option_collections": ["opt"],
            "option_collection_hashes": ["102210fe594ee9b33d82058545b1ed14f4c8206e"],
            "job_types": ["B2G Emulator Image Build (B)"]},
        author=test_sheriff,
    )
    exclusion_profile = ExclusionProfile.objects.create(
        name="exprof",
        is_default=False,
        author=test_sheriff,
    )
    exclusion_profile.exclusions.add(job_exclusion)
    exclusion_profile.save()

    resp = webapp.get(reverse(
        "jobs-list", kwargs={"project": test_repository.name}) +
        "?exclusion_profile=exprof&visibility=excluded").json
    assert len(resp['results']) == 1
    assert resp['results'][0]['job_guid'] == '9abb6f7d54a49d763c584926377f09835c5e1a32'


def test_job_detail(webapp, test_job):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("jobs-detail",
                kwargs={"project": test_job.repository.name,
                        "pk": test_job.id})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == test_job.id


def test_job_retrigger_unauthorized(webapp, test_repository):
    """
    Validate that only authenticated users can hit this endpoint.
    """
    url = reverse("jobs-retrigger",
                  kwargs={"project": test_repository.name})
    webapp.post(url, {"job_id_list": [1]}, status=403)


def test_job_retrigger_authorized(webapp, eleven_jobs_stored,
                                  pulse_action_consumer, test_user):
    """
    Validate that only authenticated users can hit this endpoint.
    """
    client = APIClient()
    client.force_authenticate(user=test_user)

    job = Job.objects.get(id=1)
    url = reverse("jobs-retrigger",
                  kwargs={"project": job.repository.name})
    client.post(url, {"job_id_list": [job.id]}, format='json')

    message = pulse_action_consumer.get(block=True, timeout=2)
    content = message.payload

    assert content['project'] == job.repository.name
    assert content['action'] == 'retrigger'
    assert content['job_guid'] == job.guid
    assert content['requester'] == test_user.email


def test_job_cancel_authorized(webapp, test_repository, eleven_jobs_stored,
                               pulse_action_consumer, test_user):
    """
    Validate that job gets updated when a valid user hits this endpoint.
    """
    client = APIClient()
    client.force_authenticate(user=test_user)

    # get the job, set its state to pending
    job = Job.objects.get(id=1)
    job.state = 'pending'
    job.save()

    url = reverse("jobs-cancel",
                  kwargs={
                      "project": test_repository.name,
                      "pk": job.id
                  })
    client.post(url)

    message = pulse_action_consumer.get(block=True, timeout=2)
    content = message.payload

    assert content['project'] == test_repository.name
    assert content['action'] == 'cancel'
    assert content['job_guid'] == job.guid
    assert content['requester'] == test_user.email

    # validate that we modified the job structures appropriately
    old_last_modified = job.last_modified
    assert old_last_modified < Job.objects.values_list(
        'last_modified', flat=True).get(id=job.id)


def test_job_detail_bad_project(webapp, transactional_db):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    badurl = reverse("jobs-detail",
                     kwargs={"project": "badproject", "pk": 1})

    webapp.get(badurl, status=404)


def test_job_detail_not_found(webapp, test_repository):
    """
    test retrieving a HTTP 404 from the jobs-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("jobs-detail",
                kwargs={"project": test_repository.name, "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404


@pytest.mark.skipif(True, reason="Awaiting landing of Bug 1177519")
def test_job_error_lines(webapp, eleven_jobs_stored, failure_lines, classified_failures):
    """
    test retrieving failure lines
    """
    job = Job.objects.get(id=1)

    resp = webapp.get(
        reverse("jobs-failure-lines",
                kwargs={"project": job.repository.name, "pk": job.id})
    )
    assert resp.status_int == 200

    failures = resp.json
    assert isinstance(failures, list)

    exp_failure_keys = ["id", "job_guid", "repository", "action", "line",
                        "test", "subtest", "status", "expected", "message",
                        "signature", "level", "created", "modified", "matches",
                        "best_classification", "best_is_verified", "classified_failures",
                        "unstructured_bugs"]

    assert set(failures[0].keys()) == set(exp_failure_keys)

    matches = failures[0]["matches"]
    assert isinstance(matches, list)

    exp_matches_keys = ["id", "matcher", "score", "classified_failure"]

    assert set(matches[0].keys()) == set(exp_matches_keys)

    classified = failures[0]["classified_failures"][0]
    assert isinstance(classified, dict)

    exp_classified_keys = ["id", "bug_number", "bug"]

    assert set(classified.keys()) == set(exp_classified_keys)


def test_text_log_steps_and_errors(webapp, test_job):

    TextLogStep.objects.create(job=test_job,
                               name='step1',
                               started=datetime.datetime.utcfromtimestamp(0),
                               finished=datetime.datetime.utcfromtimestamp(100),
                               started_line_number=1,
                               finished_line_number=100,
                               result=TextLogStep.SUCCESS)
    step2 = TextLogStep.objects.create(job=test_job,
                                       name='step2',
                                       started=datetime.datetime.utcfromtimestamp(101),
                                       finished=datetime.datetime.utcfromtimestamp(200),
                                       started_line_number=101,
                                       finished_line_number=200,
                                       result=TextLogStep.TEST_FAILED)
    TextLogError.objects.create(step=step2, line='failure 1',
                                line_number=101)
    TextLogError.objects.create(step=step2, line='failure 2',
                                line_number=102)
    resp = webapp.get(
        reverse("jobs-text-log-steps",
                kwargs={"project": test_job.repository.name,
                        "pk": test_job.id})
    )
    assert resp.status_int == 200
    assert resp.json == [
        {
            'errors': [],
            'finished': '1970-01-01T00:01:40',
            'finished_line_number': 100,
            'id': 1,
            'name': 'step1',
            'result': 'success',
            'started': '1970-01-01T00:00:00',
            'started_line_number': 1
        },
        {
            'errors': [
                {
                    'id': 1,
                    'line': 'failure 1',
                    'line_number': 101,
                    'bug_suggestions': {
                        'search': 'failure 1',
                        'search_terms': ['failure 1'],
                        'bugs': {'open_recent': [], 'all_others': []}
                    }
                },
                {
                    'id': 2,
                    'line': 'failure 2',
                    'line_number': 102,
                    'bug_suggestions': {
                        'search': 'failure 2',
                        'search_terms': ['failure 2'],
                        'bugs': {'open_recent': [], 'all_others': []}
                    }
                }
            ],
            'finished': '1970-01-01T00:03:20',
            'finished_line_number': 200,
            'id': 2,
            'name': 'step2',
            'result': 'testfailed',
            'started': '1970-01-01T00:01:41',
            'started_line_number': 101
        }
    ]


def test_text_log_errors(webapp, test_job):

    TextLogStep.objects.create(job=test_job,
                               name='step1',
                               started=datetime.datetime.utcfromtimestamp(0),
                               finished=datetime.datetime.utcfromtimestamp(100),
                               started_line_number=1,
                               finished_line_number=100,
                               result=TextLogStep.SUCCESS)
    step2 = TextLogStep.objects.create(job=test_job,
                                       name='step2',
                                       started=datetime.datetime.utcfromtimestamp(101),
                                       finished=datetime.datetime.utcfromtimestamp(200),
                                       started_line_number=101,
                                       finished_line_number=200,
                                       result=TextLogStep.TEST_FAILED)
    TextLogError.objects.create(step=step2, line='failure 1',
                                line_number=101)
    TextLogError.objects.create(step=step2, line='failure 2',
                                line_number=102)
    resp = webapp.get(
        reverse("jobs-text-log-errors",
                kwargs={"project": test_job.repository.name,
                        "pk": test_job.id})
    )
    assert resp.status_int == 200
    assert resp.json == [
        {
            'id': 1,
            'line': 'failure 1',
            'line_number': 101,
            'bug_suggestions': {
                'search': 'failure 1',
                'search_terms': ['failure 1'],
                'bugs': {'open_recent': [], 'all_others': []}
            }
        },
        {
            'id': 2,
            'line': 'failure 2',
            'line_number': 102,
            'bug_suggestions': {
                'search': 'failure 2',
                'search_terms': ['failure 2'],
                'bugs': {'open_recent': [], 'all_others': []}
            }
        }
    ]


@pytest.mark.parametrize(('offset', 'count', 'expected_num'),
                         [(None, None, 3),
                          (None, 2, 2),
                          (1, None, 2),
                          (0, 1, 1),
                          (2, 10, 1)])
def test_list_similar_jobs(webapp, eleven_jobs_stored,
                           offset, count, expected_num):
    """
    test retrieving similar jobs
    """
    job = Job.objects.get(id=1)

    url = reverse("jobs-similar-jobs",
                  kwargs={"project": job.repository.name, "pk": job.id})
    params = '&'.join(['{}={}'.format(k, v) for k, v in
                       [('offset', offset), ('count', count)] if v])
    if params:
        url += '?{}'.format(params)
    resp = webapp.get(url)

    assert resp.status_int == 200

    similar_jobs = resp.json

    assert 'results' in similar_jobs

    assert isinstance(similar_jobs['results'], list)

    assert len(similar_jobs['results']) == expected_num


def test_job_create(webapp, test_repository, test_user, eleven_job_blobs,
                    failure_classifications, monkeypatch):
    monkeypatch.setattr(JobsViewSet, 'permission_classes', ())

    url = reverse("jobs-list",
                  kwargs={"project": test_repository.name})
    client = APIClient()
    resp = client.post(url, data=eleven_job_blobs, format="json")

    assert resp.status_code == 200

    # test that the jobs were actually created
    assert Job.objects.count() == 11
    test_job_list(webapp, None, test_repository, 0, 11, 11)


@pytest.mark.parametrize('lm_key,lm_value,exp_status, exp_job_count', [
    ("last_modified__gt",  "2016-07-18T22:16:58.000", 200, 8),
    ("last_modified__lt",  "2016-07-18T22:16:58.000", 200, 3),
    ("last_modified__gt",  "-Infinity", HTTP_400_BAD_REQUEST, 0),
    ("last_modified__gt",  "whatever", HTTP_400_BAD_REQUEST, 0),
    ])
def test_last_modified(webapp, eleven_jobs_stored, test_repository,
                       lm_key, lm_value, exp_status, exp_job_count):
    try:
        param_date = parser.parse(lm_value)
        newer_date = param_date - datetime.timedelta(minutes=10)

        # modify job last_modified for 3 jobs
        Job.objects.filter(
            id__in=[j.id for j in Job.objects.all()[:3]]).update(
                last_modified=newer_date)
    except ValueError:
        # no problem.  these params are the wrong
        pass

    url = reverse("jobs-list", kwargs={"project": test_repository.name})
    final_url = url + ("?{}={}".format(lm_key, lm_value))

    resp = webapp.get(final_url, expect_errors=(exp_status != 200))
    assert resp.status_int == exp_status
    if exp_status == 200:
        assert len(resp.json["results"]) == exp_job_count
