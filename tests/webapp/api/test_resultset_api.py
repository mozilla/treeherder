import pytest
from django.core.urlresolvers import reverse
from treeherder.webapp.api.views import ResultSetViewSet


def test_resultset_list(webapp, eleven_jobs_processed, jm):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
    """
    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project})
    )

    assert resp.status_int == 200
    assert isinstance(resp.json, list)
    rs_list = resp.json

    assert len(rs_list) == 10
    exp_keys = set([
        u'id',
        u'repository_id',
        u'push_timestamp',
        u'author',
        u'comments',
        u'revision_hash',
        u'revision',
        u'revision_list',
    ])
    for rs in rs_list:
        assert set(rs.keys()) == exp_keys


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
    assert resp.json == {"message": "No project with name foo"}


def test_resultset_list_empty_rs_still_show(webapp, initial_data,
                                            sample_resultset, jm):
    """
    test retrieving a resultset list, when the resultset has no jobs.
    should not show.
    """
    jm.store_result_set_data(sample_resultset)

    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project}),
    )
    assert resp.status_int == 200
    assert len(resp.json) == 10


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
    assert resp.json == {
        "message": ("ObjectNotFoundException: For table 'result_set':"
                    " {'id': u'-32767'}")
    }


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
    assert resp.json == {"message": "No project with name foo"}


def test_resultset_create(webapp, pushlog_sample, jm, initial_data):
    """
    test posting data to the resultset endpoint via webtest.
    extected result are:
    - return code 200
    - return message successful
    - 1 resultset stored in the jobs schema
    """

    resp = webapp.post_json(
        reverse('resultset-list',
                kwargs={'project': jm.project}),
        params=sample_resultset
    )
    assert resp.status_int == 200
    assert resp.json['message'] == 'well-formed JSON stored'

    stored_objs = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.resultset_by_rev_hash",
        placeholders=[sample_resultset[0]['revision_hash']]
    )

    assert len(stored_objs) == 1

    assert stored_objs[0]['revision_hash'] == sample_resultset[0]['revision_hash']


@pytest.mark.xfail
def test_result_set_add_job(jm, initial_data, webapp, job_sample, sample_resultset):

    jm.store_result_set_data(sample_resultset)

    job_sample['revision_hash'] = sample_resultset[0]['revision_hash']
    job_sample['job']['log_references'] = []

    resp = webapp.post_json(
        reverse("resultset-add-job",
                kwargs={"project": jm.project, "pk": 1}),
        params=[job_sample]
    )
    assert resp.status_int == 200
