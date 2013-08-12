import json
import pytest
from django.core.urlresolvers import reverse
xfail = pytest.mark.xfail


def test_resultset_list(webapp, twenty_jobs_processed, jm):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
    """
    resp = webapp.get(
        reverse("resultset-list", kwargs={"project": jm.project})
    )

    assert resp.status_int == 200
    assert isinstance(resp.json, list)
    jobs = resp.json

    assert len(jobs) == 10
    exp_keys = [
        u'id',
        u'repository_id',
        u'push_timestamp',
        u'author',
        u'comments',
        u'revision_hash',
        u'revision',
    ]
    for job in jobs:
        print job
        print set(exp_keys)
        assert set(job.keys()) == set(exp_keys)

def test_resultset_detail(webapp, twenty_jobs_processed, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    rs = jm.get_result_set_list(0, 1).next()

    resp = webapp.get(
        reverse("resultset-detail",
                kwargs={"project": jm.project, "pk": rs["id"]})
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
        "message": ("ObjectNotFoundException: For table 'job':"
                    " {'contenttype': 'jobs', 'id': u'-32767',"
                    " 'procedure': 'generic.selects.get_row_by_id'}")
    }
