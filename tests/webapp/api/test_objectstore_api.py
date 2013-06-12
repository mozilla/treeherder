from django.core.urlresolvers import reverse


def test_objectstore_create(webapp, job_sample, jm):
    """
    test posting data to the objectstore via webtest.
    extected result are:
    - return code 200
    - return message successful
    - 1 job stored in the objectstore
    """

    resp = webapp.post_json(
        reverse('objectstore-list',
                kwargs={'project': jm.project}),
        params=job_sample
    )
    assert resp.status_int == 200
    assert resp.json['message'] == 'well-formed JSON stored'

    stored_objs = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.row_by_guid",
        placeholders=[job_sample["job"]["job_guid"]]
    )

    assert len(stored_objs) == 1

    assert stored_objs[0]['job_guid'] == job_sample["job"]["job_guid"]


def test_objectstore_list(webapp, ten_jobs_stored, jm):
    """
    test retrieving a list of ten json blobs from the objectstore-list
    endpoint.
    """
    resp = webapp.get(
        reverse('objectstore-list',
                kwargs={'project': jm.project})
    )
    assert resp.status_int == 200

    assert isinstance(resp.json, list)

    assert len(resp.json) == 10


def test_objectstore_detail(webapp, ten_jobs_stored, jm):
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


def test_objectstore_detail_not_found(webapp, jm):
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
