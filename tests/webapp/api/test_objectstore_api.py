from django.core.urlresolvers import reverse

from thclient import TreeherderJobCollection

from tests import test_utils


def test_objectstore_create(job_sample, jm):
    """
    test posting data to the objectstore via webtest.
    extected result are:
    - return code 200
    - return message successful
    - 1 job stored in the objectstore
    """

    tjc = TreeherderJobCollection()
    tj = tjc.get_job(job_sample)
    tjc.add(tj)

    resp = test_utils.post_collection(jm.project, tjc)

    assert resp.status_int == 200
    assert resp.json['message'] == 'well-formed JSON stored'

    stored_objs = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.row_by_guid",
        placeholders=[job_sample["job"]["job_guid"]]
    )

    assert len(stored_objs) == 1

    assert stored_objs[0]['job_guid'] == job_sample["job"]["job_guid"]

    jm.disconnect()


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


def test_objectstore_with_bad_secret(job_sample, jm):
    """
    test calling with the wrong project secret.
    extected result are:
    - return code 403
    - return message authentication failed
    """

    tjc = TreeherderJobCollection()
    tj = tjc.get_job(job_sample)
    tjc.add(tj)

    resp = test_utils.post_collection(
        jm.project, tjc, status=403, consumer_secret='not so secret'
        )

    assert resp.status_int == 403
    assert resp.json['detail'] == "Client authentication failed for project, {0}".format(jm.project)
    assert resp.json['response'] == "invalid_client"

def test_objectstore_with_bad_key(job_sample, jm):
    """
    test calling with the wrong project key.
    extected result are:
    - return code 403
    - return message failed
    """

    tjc = TreeherderJobCollection()
    tj = tjc.get_job(job_sample)
    tjc.add(tj)

    resp = test_utils.post_collection(
        jm.project, tjc, status=403, consumer_key='wrong key'
        )

    assert resp.status_int == 403
    assert resp.json['response'] == "access_denied"
    assert resp.json['detail'] == "oauth_consumer_key does not match project, {0}, credentials".format(jm.project)
