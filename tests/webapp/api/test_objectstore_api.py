from django.core.urlresolvers import reverse
import simplejson as json


def test_job_ingestion(webapp, job_sample, initial_data, jm):
    resp = webapp.post_json(
        reverse('objectstore-list',
                kwargs={'project': jm.project}),
        params=job_sample
    )
    assert resp.status_int == 200
    assert resp.json['message'] == 'well-formed JSON stored'
