import gzip

import pytest
import responses
from django.core.urlresolvers import reverse
from django.utils.six import BytesIO

from treeherder.model.models import (Job,
                                     JobLog)


@pytest.mark.parametrize('logname, line_range', [('buildbot_text', (0, 10)),
                                                 ('builds-4h', (0, 10)),
                                                 ('builds-4h', (5, 8)),
                                                 ('builds-4h', (1, 11))])
def test_logslice_api(test_repository, webapp, activate_responses, logname,
                      line_range):
    job = Job.objects.create(repository=test_repository,
                             guid="12345", project_specific_id=1)
    fake_log_url = 'http://www.fakelog.com/log.gz'
    JobLog.objects.create(job=job, name=logname,
                          url=fake_log_url, status=JobLog.PARSED)

    lines = ['cheezburger %s' % i for i in range(10)]

    # set up a gzipped file response
    content = BytesIO()
    with gzip.GzipFile('none', 'w', fileobj=content) as gz:
        gz.write("\n".join(lines) + '\n')
    content.seek(0)
    responses.add(responses.GET, fake_log_url,
                  body=content.read(),
                  content_type="text/plain;charset=utf-8", status=200)

    # now test it
    resp = webapp.get(reverse('logslice-list',
                              kwargs={"project": test_repository.name}) +
                      '?start_line={}&end_line={}&job_id=1'.format(line_range[0],
                                                                   line_range[1]))
    assert resp.json == [{'index': i + line_range[0], 'text': l + '\n'} for (i, l) in
                         enumerate(lines[line_range[0]:line_range[1]])]
