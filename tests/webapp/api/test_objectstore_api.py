from django.core.urlresolvers import reverse
import simplejson as json


def test_job_ingestion(webapp, job_sample, initial_data, jm):
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
