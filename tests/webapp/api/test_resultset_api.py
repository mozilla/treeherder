import json
import pytest
from django.core.urlresolvers import reverse
xfail = pytest.mark.xfail


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
    exp_keys = [
        u'id',
        u'repository_id',
        u'push_timestamp',
        u'author',
        u'comments',
        u'revision_hash',
        u'revision',
    ]
    for rs in rs_list:
        print rs
        print set(exp_keys)
        assert set(rs.keys()) == set(exp_keys)


def test_resultset_detail(webapp, eleven_jobs_processed, jm):
    """
    test retrieving a single job from the jobs-detail
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
