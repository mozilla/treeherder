from django.core.urlresolvers import reverse


def xtest_update_state_success(webapp, ten_jobs_processed, jm):
    """
    test setting the status of a job via webtest.
    extected result are:
    - return code 200
    - return message successful
    - job status updated
    """

    joblist = jm.get_job_list(0, 1)
    # from treeherder.webapp.api.urls import project_bound_router
    # # print list(joblist)
    # for urlpattern in project_bound_router.urls:
    #     print urlpattern

    job = joblist.next()

    url = reverse('jobs-update-state',
                kwargs={
                    'project': jm.project,
                    'pk': job["id"]
                })

    print url
    resp = webapp.post(
        reverse('jobs-update-state',
                kwargs={
                    'project': jm.project,
                    'pk': job["id"],
                }),
        params={"state": "foo"},
    )
    assert resp.status_int == 200
    assert resp.json['message'] == 'well-formed JSON stored'


def test_job_list(webapp, ten_jobs_processed, jm):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
    """
    resp = webapp.get(
        reverse('jobs-list',
                kwargs={'project': jm.project})
    )
    assert resp.status_int == 200

    assert isinstance(resp.json, list)

    assert len(resp.json) == 10


def xtest_objectstore_detail(webapp, ten_jobs_stored, jm):
    """
    test retrieving a single json blobs from the objectstore-detail
    endpoint.
    """
    resp = webapp.get(
        reverse('objectstore-detail',
                kwargs={'project': jm.project, 'pk': 'myguid1'})
    )
    assert resp.status_int == 200

    assert isinstance(resp.json, dict)

    assert resp.json['job']['job_guid'] == 'myguid1'


def xtest_objectstore_detail_not_found(webapp, jm):
    """
    test retrieving a HTTP 404 from the objectstore-detail
    endpoint.
    """
    resp = webapp.get(
        reverse('objectstore-detail',
                kwargs={'project': jm.project, 'pk': 'myguid1'}),
        expect_errors=True
    )
    assert resp.status_int == 404


def xtest_objectstore_create_bad_project(webapp, job_sample, jm):
    """
    test calling with bad project name.
    extected result are:
    - return code 404
    - return message failed
    """

    url = reverse('objectstore-list',
                  kwargs={'project': jm.project})
    badurl = url.replace(jm.project, "badproject")
    resp = webapp.post_json(
        badurl,
        params=job_sample,
        status=404
    )
    assert resp.status_int == 404
    assert resp.json['message'] == ("No dataset found for project "
                                    "u'badproject', contenttype "
                                    "'objectstore'.")
