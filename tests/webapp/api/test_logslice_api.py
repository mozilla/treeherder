import gzip

import pytest
import responses
from django.core.urlresolvers import reverse
from django.utils.six import BytesIO

from treeherder.model.models import (Job,
                                     JobLog)


@pytest.mark.parametrize('logname, line_range, gzipped, num_loads', [
    ('buildbot_text', (0, 10), True, 1),
    ('builds-4h', (0, 10), True, 1),
    ('builds-4h', (0, 10), False, 1),
    ('builds-4h', (0, 10), True, 2),
    ('builds-4h', (0, 10), False, 2),
    ('builds-4h', (5, 8), True, 1),
    ('builds-4h', (1, 11), True, 1)])
def test_logslice_api(test_repository, webapp, activate_responses, logname,
                      line_range, gzipped, num_loads):
    job = Job.objects.create(repository=test_repository,
                             guid="12345", project_specific_id=1)
    fake_log_url = 'http://www.fakelog.com/log.gz'
    JobLog.objects.create(job=job, name=logname,
                          url=fake_log_url, status=JobLog.PARSED)

    lines = ['cheezburger %s' % i for i in range(10)]

    # set up a file response
    text = "\n".join(lines) + '\n'
    content = BytesIO()
    if gzipped:
        with gzip.GzipFile('none', 'w', fileobj=content) as gz:
            gz.write(text)
    else:
        content.write(text)
    content.seek(0)
    responses.add(responses.GET, fake_log_url,
                  body=content.read(),
                  content_type="text/plain;charset=utf-8", status=200)

    # now test it
    for i in range(num_loads):
        resp = webapp.get(reverse('logslice-list',
                                  kwargs={"project": test_repository.name}) +
                          '?start_line={}&end_line={}&job_id=1'.format(line_range[0],
                                                                       line_range[1]))
        assert resp.json == [{'index': i + line_range[0], 'text': l + '\n'} for (i, l) in
                             enumerate(lines[line_range[0]:line_range[1]])]
