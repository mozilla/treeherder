# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.urlresolvers import reverse
from rest_framework.test import APIClient
from django.contrib.auth.models import User

from treeherder.client import TreeherderResultSetCollection
from tests import test_utils

from treeherder.webapp.api import utils
import json


def test_resultset_list(webapp, eleven_jobs_processed, jm):
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
        u'test_treeherder'
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


def test_resultset_list_empty_rs_still_show(webapp, initial_data,
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

    jm.disconnect()


def test_resultset_list_filter_by_revision(webapp, eleven_jobs_processed, jm):
    """
    test retrieving a resultset list, filtered by a date range
    """

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
        {"fromchange": "21fb3eed1b5f", "tochange": "909f55c626a8"}
    )
    assert resp.status_int == 200
    results = resp.json['results']
    meta = resp.json['meta']
    assert len(results) == 4
    assert set([rs["revision"] for rs in results]) == set(
        ["909f55c626a8", "71d49fee325a", "bb57e9f67223", "21fb3eed1b5f"]
    )
    assert(meta == {
        u'count': 4,
        u'fromchange': u'21fb3eed1b5f',
        u'filter_params': {
            u'push_timestamp__gte': 1384363842,
            u'push_timestamp__lte': 1384365942
        },
        u'repository': u'test_treeherder',
        u'tochange': u'909f55c626a8'}
    )


def test_resultset_list_filter_by_date(webapp, initial_data,
                                       sample_resultset, jm):
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
    assert set([rs["revision"] for rs in results]) == set(
        ["909f55c626a8", "71d49fee325a", "bb57e9f67223", "668424578a0d"]
    )
    assert(meta == {
        u'count': 4,
        u'enddate': u'2013-08-13',
        u'filter_params': {
            u'push_timestamp__gte': 1376118000.0,
            u'push_timestamp__lt': 1376463600.0
        },
        u'repository': u'test_treeherder',
        u'startdate': u'2013-08-10'}
    )

    jm.disconnect()


def test_resultset_list_without_jobs(webapp, initial_data,
                                     sample_resultset, jm):
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
        u'repository': u'test_treeherder'
    }

    jm.disconnect()


def test_resultset_detail(webapp, eleven_jobs_processed, jm):
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


def test_resultset_create(sample_resultset, jm, initial_data):
    """
    test posting data to the resultset endpoint via webtest.
    extected result are:
    - return code 200
    - return message successful
    - 1 resultset stored in the jobs schema
    """

    trsc = TreeherderResultSetCollection()

    for rs in sample_resultset:
        rs = trsc.get_resultset(rs)
        trsc.add(rs)

    resp = test_utils.post_collection(jm.project, trsc)

    assert resp.status_int == 200
    assert resp.json['message'] == 'well-formed JSON stored'

    stored_objs = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.resultset_by_rev_hash",
        placeholders=[sample_resultset[0]['revision_hash']]
    )

    assert len(stored_objs) == 1
    assert stored_objs[0]['revision_hash'] == sample_resultset[0]['revision_hash']

    jm.disconnect()


def test_resultset_with_bad_secret(sample_resultset, jm, initial_data):

    trsc = TreeherderResultSetCollection()
    for rs in sample_resultset:
        rs = trsc.get_resultset(rs)
        trsc.add(rs)

    resp = test_utils.post_collection(
        jm.project, trsc, status=403, consumer_secret="horrible secret"
    )

    assert resp.status_int == 403
    assert resp.json['detail'] == "Client authentication failed for project, {0}".format(jm.project)
    assert resp.json['response'] == "invalid_client"


def test_resultset_with_bad_key(sample_resultset, jm, initial_data):

    trsc = TreeherderResultSetCollection()
    for rs in sample_resultset:
        rs = trsc.get_resultset(rs)
        trsc.add(rs)

    resp = test_utils.post_collection(
        jm.project, trsc, status=403, consumer_key="horrible-key"
    )

    assert resp.status_int == 403
    assert resp.json['response'] == "access_denied"
    assert resp.json['detail'] == "oauth_consumer_key does not match project, {0}, credentials".format(jm.project)


def test_resultset_cancel_all(jm, resultset_with_three_jobs, pulse_action_consumer):
    """
    Issue cancellation of a resultset with three unfinished jobs.
    """
    client = APIClient()
    user = User.objects.create(username="user", email="foo-cancel@example.com")
    client.force_authenticate(user=user)

    # Ensure all jobs are pending..
    jobs = jm.get_job_list(0, 3)
    for job in jobs:
        assert job['state'] == 'pending'

    url = reverse("resultset-cancel-all",
                  kwargs={"project": jm.project, "pk": resultset_with_three_jobs})
    client.post(url)

    # Ensure all jobs are cancelled..
    jobs = jm.get_job_list(0, 3)
    for job in jobs:
        assert job['state'] == 'completed'
        assert job['result'] == 'usercancel'

    for _ in range(0, 3):
        message = pulse_action_consumer.get(block=True, timeout=2)
        content = json.loads(message.body)

        assert content['action'] == 'cancel'
        assert content['project'] == jm.project

    user.delete()
