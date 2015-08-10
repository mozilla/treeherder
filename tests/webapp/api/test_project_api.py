def test_project_endpoint(webapp, eleven_jobs_stored, jm):
    """
    tests the project endpoint
    """
    url = '/api/project/%s' % jm.project
    resp = webapp.get(url)
    assert resp.json['max_job_id'] == 11
    assert resp.json['max_performance_artifact_id'] == 0


def test_project_endpoint_does_not_exist(webapp, eleven_jobs_stored, jm):
    """
    tests the project endpoint where project does not exist
    """
    url = '/api/project/%s1234' % jm.project
    resp = webapp.get(url, status=404)
    assert resp.status_int == 404
