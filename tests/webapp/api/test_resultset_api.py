import copy

from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from tests import test_utils
from treeherder.client import TreeherderResultSetCollection
from treeherder.model.models import (FailureClassification,
                                     Job,
                                     JobNote)
from treeherder.webapp.api import utils


def test_resultset_list(webapp, eleven_jobs_stored, jm, test_project):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.  ``full`` set to false, so it doesn't return revisions.
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
        u'comments',
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


def test_resultset_list_bad_project(webapp, jm):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
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


def test_resultset_list_single_long_revision_stored_long(webapp, test_repository,
                                                         sample_resultset, jm,
                                                         test_project):
    """
    test retrieving a resultset list with store long revision, filtered by a single long revision
    """

    # store a resultset with long revision
    resultset = copy.deepcopy(sample_resultset[0])
    resultset["revisions"][0]["revision"] = "21fb3eed1b5f3456789012345678901234567890"
    jm.store_result_set_data([resultset])

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
        {"revision": "21fb3eed1b5f3456789012345678901234567890"}
    )
    assert resp.status_int == 200
    results = resp.json['results']
    meta = resp.json['meta']
    assert len(results) == 1
    assert set([rs["revision"] for rs in results]) == {"21fb3eed1b5f3456789012345678901234567890"}
    assert(meta == {
        u'count': 1,
        u'revision': u'21fb3eed1b5f3456789012345678901234567890',
        u'filter_params': {
            u'revisions_long_revision': u'21fb3eed1b5f3456789012345678901234567890'
        },
        u'repository': test_project}
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
    sample_resultset[3]["push_timestamp"] = utils.to_timestamp("2013-08-09")
    sample_resultset[4]["push_timestamp"] = utils.to_timestamp("2013-08-10")
    sample_resultset[5]["push_timestamp"] = utils.to_timestamp("2013-08-11")
    sample_resultset[6]["push_timestamp"] = utils.to_timestamp("2013-08-12")
    sample_resultset[7]["push_timestamp"] = utils.to_timestamp("2013-08-13")

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
            u'push_timestamp__gte': 1376118000.0,
            u'push_timestamp__lt': 1376463600.0
        },
        u'repository': test_project,
        u'startdate': u'2013-08-10'}
    )


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

    rs_list = jm.get_result_set_list(0, 10)
    rs = rs_list[0]

    resp = webapp.get(
        reverse("resultset-detail",
                kwargs={"project": jm.project, "pk": int(rs["id"])})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == rs["id"]


def test_result_set_detail_not_found(webapp, jm):
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


def test_result_set_detail_bad_project(webapp, jm):
    """
    test retrieving a HTTP 404 from the resultset-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("resultset-detail",
                kwargs={"project": "foo", "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404
    assert resp.json == {"detail": "No project with name foo"}


def test_resultset_create(jm, test_repository, sample_resultset,
                          mock_post_json):
    """
    test posting data to the resultset endpoint via webtest.
    extected result are:
    - return code 200
    - return message successful
    - 1 resultset stored in the jobs schema
    """

    # store the first two, so we submit all, but should properly not re-
    # add the others.

    jm.store_result_set_data(sample_resultset[:2])

    trsc = TreeherderResultSetCollection()
    exp_revision_hashes = set()
    for rs in sample_resultset:
        rs.update({'author': 'John Doe'})
        result_set = trsc.get_resultset(rs)
        trsc.add(result_set)
        exp_revision_hashes.add(rs["revision"])

    resp = test_utils.post_collection(jm.project, trsc)

    act_revision_hashes = {x["long_revision"] for x in resp.json["resultsets"]}
    assert exp_revision_hashes == act_revision_hashes

    stored_objs = jm.get_dhub().execute(
        proc="jobs_test.selects.resultset_by_long_revision",
        placeholders=[sample_resultset[0]['revision']]
    )

    assert len(stored_objs) == 1
    assert stored_objs[0]['long_revision'] == sample_resultset[0]['revision']


def test_resultset_cancel_all(jm, resultset_with_three_jobs,
                              pulse_action_consumer, test_user):
    """
    Issue cancellation of a resultset with three unfinished jobs.
    """
    client = APIClient()
    client.force_authenticate(user=test_user)

    # Ensure all jobs are pending..
    for (ds_job, job) in zip(jm.get_job_list(0, 3), Job.objects.all()):
        assert ds_job['state'] == 'pending'
        assert ds_job['result'] == 'success'
        assert job.result == Job.SUCCESS

    url = reverse("resultset-cancel-all",
                  kwargs={"project": jm.project, "pk": resultset_with_three_jobs})
    client.post(url)

    # Ensure all jobs are cancelled..
    for (ds_job, job) in zip(jm.get_job_list(0, 3), Job.objects.all()):
        assert ds_job['state'] == 'completed'
        assert ds_job['result'] == 'usercancel'
        assert job.result == Job.USERCANCEL

    for _ in range(0, 3):
        message = pulse_action_consumer.get(block=True, timeout=2)
        content = message.payload

        assert content['action'] == 'cancel'
        assert content['project'] == jm.project


def test_resultset_status(jm, webapp, eleven_jobs_stored, test_user):
    """
    test retrieving the status of a resultset
    """
    # create a failure classification corresponding to "not successful"
    failure_classification = FailureClassification.objects.create(
        id=2, name="fixed by commit")

    rs_list = jm.get_result_set_list(0, 10)
    rs = rs_list[0]

    resp = webapp.get(
        reverse("resultset-status",
                kwargs={"project": jm.project, "pk": int(rs["id"])})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json == {'success': 1}

    # the first ten resultsets have one job each, so resultset.id == job.id
    JobNote.objects.create(job=Job.objects.get(project_specific_id=rs["id"]),
                           failure_classification=failure_classification,
                           user=test_user,
                           text='A random note')

    resp = webapp.get(
        reverse("resultset-status",
                kwargs={"project": jm.project, "pk": int(rs["id"])})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json == {}
