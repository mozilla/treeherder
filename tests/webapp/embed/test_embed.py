from django.core.urlresolvers import reverse


def test_push_status(webapp, test_job):
    resp = webapp.get(
        reverse("push_status",
                kwargs={
                    "repository": test_job.push.repository.name,
                    "revision": test_job.push.revision
                })
    )
    assert 'success</a>: 1' in resp
