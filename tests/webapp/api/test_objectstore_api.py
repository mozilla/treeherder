from django.core.urlresolvers import reverse


def test_job_ingestion(webapp, job_sample, initial_data):
    resp = webapp.post_json(
        reverse('job_ingestion_endpoint',
                kwargs={'project': 'testproject', 'guid': 'myguid'}),
        params=dict(data=job_sample)
    )
    print resp
    assert resp['status'] == 'well-formed JSON stored'
