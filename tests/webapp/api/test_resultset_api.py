import copy
import datetime

from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from tests import test_utils
from treeherder.client import TreeherderResultSetCollection
from treeherder.model.models import (FailureClassification,
                                     JobNote,
                                     Push)
from treeherder.webapp.api import utils


def test_resultset_list_basic(webapp, eleven_jobs_stored, jm, test_project):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
    """
    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}))

    results = resp.json['results']
    meta = resp.json['meta']

    assert resp.status_int == 200
    assert isinstance(results, list)

    assert len(results) == 10
    exp_keys = set([
        u'id',
        u'repository_id',
        u'author',
        u'revision_hash',
        u'revision',
        u'revisions',
        u'revision_count',
        u'revisions_uri',
        u'push_timestamp',
    ])
    for rs in results:
        assert set(rs.keys()) == exp_keys

    assert(meta == {
        u'count': 10,
        u'filter_params': {},
        u'repository':
        test_project
    })


def test_resultset_list_bad_project(webapp, transactional_db):
    """
    test that we have a sane error when the repository does not exist
    """
    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": "foo"}),
        expect_errors=True
    )

    assert resp.status_int == 404
    assert resp.json == {"detail": "No project with name foo"}


def test_resultset_list_empty_rs_still_show(webapp, test_repository,
                                            sample_resultset, jm):
    """
    test retrieving a resultset list, when the resultset has no jobs.
    should show.
    """
    jm.store_result_set_data(sample_resultset)

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
    )
    assert resp.status_int == 200
    assert len(resp.json['results']) == 10


def test_resultset_list_single_short_revision(webapp, eleven_jobs_stored, jm, test_project):
    """
    test retrieving a resultset list, filtered by single short revision
    """

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
        {"revision": "45f8637cb9f7"}
    )
    assert resp.status_int == 200
    results = resp.json['results']
    meta = resp.json['meta']
    assert len(results) == 1
    assert set([rs["revision"] for rs in results]) == {"45f8637cb9f78f19cb8463ff174e81756805d8cf"}
    assert(meta == {
        u'count': 1,
        u'revision': u'45f8637cb9f7',
        u'filter_params': {
            u'revisions_short_revision': "45f8637cb9f7"
        },
        u'repository': test_project}
    )


def test_resultset_list_single_long_revision(webapp, eleven_jobs_stored, jm, test_project):
    """
    test retrieving a resultset list, filtered by a single long revision
    """

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
        {"revision": "45f8637cb9f78f19cb8463ff174e81756805d8cf"}
    )
    assert resp.status_int == 200
    results = resp.json['results']
    meta = resp.json['meta']
    assert len(results) == 1
    assert set([rs["revision"] for rs in results]) == {"45f8637cb9f78f19cb8463ff174e81756805d8cf"}
    assert(meta == {
        u'count': 1,
        u'revision': u'45f8637cb9f78f19cb8463ff174e81756805d8cf',
        u'filter_params': {
            u'revisions_long_revision': u'45f8637cb9f78f19cb8463ff174e81756805d8cf'
        },
        u'repository': test_project}
    )


def test_resultset_list_single_long_revision_stored_long(webapp, sample_resultset, jm,
                                                         test_project):
    """
    test retrieving a resultset list with store long revision, filtered by a single long revision
    """
    long_revision = "21fb3eed1b5f3456789012345678901234567890"

    # store a resultset with long revision
    resultset = copy.deepcopy(sample_resultset[0])
    resultset["revisions"][0]["revision"] = long_revision
    jm.store_result_set_data([resultset])

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
        {"revision": long_revision}
    )
    assert resp.status_int == 200
    results = resp.json['results']
    meta = resp.json['meta']
    assert len(results) == 1
    assert set([rs["revision"] for rs in results]) == {sample_resultset[0]['revision']}
    assert(meta == {
        'count': 1,
        'revision': long_revision,
        'filter_params': {
            'revisions_long_revision': long_revision
        },
        'repository': test_project}
    )


def test_resultset_list_filter_by_revision(webapp, eleven_jobs_stored, jm, test_project):
    """
    test retrieving a resultset list, filtered by a revision range
    """

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
        {"fromchange": "130965d3df6c", "tochange": "f361dcb60bbe"}
    )
    assert resp.status_int == 200
    results = resp.json['results']
    meta = resp.json['meta']
    assert len(results) == 4
    assert set([rs["revision"] for rs in results]) == {
        u'130965d3df6c9a1093b4725f3b877eaef80d72bc',
        u'7f417c3505e3d2599ac9540f02e3dbee307a3963',
        u'a69390334818373e2d7e6e9c8d626a328ed37d47',
        u'f361dcb60bbedaa01257fbca211452972f7a74b2'
    }
    assert(meta == {
        u'count': 4,
        u'fromchange': u'130965d3df6c',
        u'filter_params': {
            u'push_timestamp__gte': 1384363842,
            u'push_timestamp__lte': 1384365942
        },
        u'repository': test_project,
        u'tochange': u'f361dcb60bbe'}
    )


def test_resultset_list_filter_by_date(webapp, test_repository,
                                       sample_resultset, jm, test_project):
    """
    test retrieving a resultset list, filtered by a date range
    """
    for (i, datestr) in zip([3, 4, 5, 6, 7], ["2013-08-09", "2013-08-10",
                                              "2013-08-11", "2013-08-12",
                                              "2013-08-13"]):
        sample_resultset[i]['push_timestamp'] = utils.to_timestamp(
            utils.to_datetime(datestr))

    jm.store_result_set_data(sample_resultset)

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
        {"startdate": "2013-08-10", "enddate": "2013-08-13"}
    )
    assert resp.status_int == 200
    results = resp.json['results']
    meta = resp.json['meta']
    assert len(results) == 4
    assert set([rs["revision"] for rs in results]) == {
        u'ce17cad5d554cfffddee13d1d8421ae9ec5aad82',
        u'7f417c3505e3d2599ac9540f02e3dbee307a3963',
        u'a69390334818373e2d7e6e9c8d626a328ed37d47',
        u'f361dcb60bbedaa01257fbca211452972f7a74b2'
    }
    assert(meta == {
        u'count': 4,
        u'enddate': u'2013-08-13',
        u'filter_params': {
            u'push_timestamp__gte': 1376092800.0,
            u'push_timestamp__lt': 1376438400.0
        },
        u'repository': test_project,
        u'startdate': u'2013-08-10'}
    )


def test_resultset_list_id_in(webapp, test_repository):
    """
    test the id__in parameter
    """
    for (id, revision, author) in [(1, '1234abcd', 'foo@bar.com'),
                                   (2, '2234abcd', 'foo2@bar.com'),
                                   (3, '3234abcd', 'foo3@bar.com')]:
        Push.objects.create(repository=test_repository,
                            revision=revision,
                            author=author,
                            time=datetime.datetime.now())
    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": test_repository.name}) +
        '?id__in=1,2'
    )
    assert resp.status_int == 200

    results = resp.json['results']
    assert len(results) == 2  # would have 3 if filter not applied
    assert set([result['id'] for result in results]) == set([1, 2])

    # test that we do something sane if invalid list passed in
    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": test_repository.name}) +
        '?id__in=1,2,foobar',
        expect_errors=True
    )
    assert resp.status_int == 400


def test_resultset_author(webapp, test_repository):
    """
    test the author parameter
    """
    for (id, revision, author) in [(1, '1234abcd', 'foo@bar.com'),
                                   (2, '2234abcd', 'foo@bar.com'),
                                   (3, '3234abcd', 'foo2@bar.com')]:
        Push.objects.create(repository=test_repository,
                            revision=revision,
                            author=author,
                            time=datetime.datetime.now())

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": test_repository.name}) +
        '?author=foo@bar.com'
    )
    assert resp.status_int == 200

    results = resp.json['results']
    assert len(results) == 2  # would have 3 if filter not applied
    assert set([result['id'] for result in results]) == set([1, 2])

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": test_repository.name}) +
        '?author=foo2@bar.com'
    )
    assert resp.status_int == 200

    results = resp.json['results']
    assert len(results) == 1  # would have 3 if filter not applied
    assert results[0]['id'] == 3


def test_resultset_list_without_jobs(webapp, test_repository,
                                     sample_resultset, jm, test_project):
    """
    test retrieving a resultset list without jobs
    """
    jm.store_result_set_data(sample_resultset)

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project})
    )
    assert resp.status_int == 200

    results = resp.json['results']
    assert len(results) == 10
    assert all([('platforms' not in result) for result in results])

    meta = resp.json['meta']

    assert meta == {
        u'count': len(results),
        u'filter_params': {},
        u'repository': test_project
    }


def test_resultset_detail(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a resultset from the resultset-detail
    endpoint.
    """

    push = Push.objects.get(id=1)

    resp = webapp.get(
        reverse("resultset-detail",
                kwargs={"project": jm.project, "pk": 1})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == push.id


def test_resultset_detail_not_found(webapp, jm):
    """
    test retrieving a HTTP 404 from the resultset-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("resultset-detail",
                kwargs={"project": jm.project, "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404


def test_resultset_detail_bad_project(webapp, jm):
    """
    test retrieving a HTTP 404 from the resultset-detail
    endpoint.
    """
    bad_pk = -32767
    resp = webapp.get(
        reverse("resultset-detail",
                kwargs={"project": "foo", "pk": bad_pk}),
        expect_errors=True
    )
    assert resp.status_int == 404


def test_resultset_create(jm, test_repository, sample_resultset,
                          mock_post_json):
    """
    test posting data to the resultset endpoint via webtest.
    extected result are:
    - return code 200
    - return message successful
    - 1 resultset stored in the jobs schema
    """

    assert Push.objects.count() == 0

    # store the first two, so we submit all, but should properly not re-
    # add the others.
    jm.store_result_set_data(sample_resultset[:2])
    assert Push.objects.count() == 2

    trsc = TreeherderResultSetCollection()
    exp_revision_hashes = set()
    for rs in sample_resultset:
        rs.update({'author': 'John Doe'})
        result_set = trsc.get_resultset(rs)
        trsc.add(result_set)
        exp_revision_hashes.add(rs["revision"])

    test_utils.post_collection(jm.project, trsc)

    assert Push.objects.count() == len(sample_resultset)
    assert set(Push.objects.values_list('revision', flat=True)) == set(
        [rs['revision'] for rs in sample_resultset])


def test_resultset_cancel_all(jm, push_with_three_jobs,
                              pulse_action_consumer, test_user):
    """
    Issue cancellation of a resultset with three unfinished jobs.
    """
    client = APIClient()
    client.force_authenticate(user=test_user)

    # Ensure all jobs are pending..
    jobs = jm.get_job_list(0, 3)
    for job in jobs:
        assert job['state'] == 'pending'

    url = reverse("resultset-cancel-all",
                  kwargs={"project": jm.project, "pk": push_with_three_jobs.id})
    client.post(url)

    # Ensure all jobs are cancelled..
    jobs = jm.get_job_list(0, 3)
    for job in jobs:
        assert job['state'] == 'completed'
        assert job['result'] == 'usercancel'

    for _ in range(0, 3):
        message = pulse_action_consumer.get(block=True, timeout=2)
        content = message.payload

        assert content['action'] == 'cancel'
        assert content['project'] == jm.project


def test_resultset_status(webapp, test_job, test_user):
    """
    test retrieving the status of a resultset
    """
    # create a failure classification corresponding to "not successful"
    failure_classification = FailureClassification.objects.create(
        id=2, name="fixed by commit")

    push = test_job.push

    resp = webapp.get(
        reverse("resultset-status",
                kwargs={"project": push.repository.name, "pk": push.id})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json == {'success': 1}

    JobNote.objects.create(job=test_job,
                           failure_classification=failure_classification,
                           user=test_user,
                           text='A random note')

    resp = webapp.get(
        reverse("resultset-status",
                kwargs={"project": push.repository.name, "pk": push.id})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json == {}
