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
        params=[job_sample]
    )
    assert resp.status_int == 200
    assert resp.json['message'] == 'well-formed JSON stored'

    stored_objs = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.row_by_guid",
        placeholders=[job_sample["job"]["job_guid"]]
    )

    assert len(stored_objs) == 1

    assert stored_objs[0]['job_guid'] == job_sample["job"]["job_guid"]


def test_objectstore_list(webapp, eleven_jobs_stored, jm):
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


def test_objectstore_detail(webapp, eleven_jobs_stored, sample_data, jm):
    """
    test retrieving a single json blobs from the objectstore-detail
    endpoint.
    """
    job_guid = sample_data.job_data[0]["job"]["job_guid"]

    resp = webapp.get(
        reverse('objectstore-detail',
                kwargs={'project': jm.project, 'pk': job_guid })
    )

    assert resp.status_int == 200

    assert isinstance(resp.json, dict)

    assert resp.json['job']['job_guid'] == job_guid


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


def test_objectstore_create_bad_project(webapp, job_sample, jm):
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
        params=[job_sample],
        status=404
    )
    assert resp.status_int == 404
    assert resp.json['message'] == "No project with name badproject"
