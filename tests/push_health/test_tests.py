import datetime

import pytest

from tests.autoclassify.utils import (create_lines,
                                      test_line)
from treeherder.model.models import (FailureLine,
                                     Job,
                                     Push,
                                     Repository,
                                     TaskclusterMetadata)
from treeherder.push_health.tests import (get_test_failures,
                                          has_job,
                                          has_line)


@pytest.mark.parametrize(('find_it',), [(True,), (False,)])
def test_has_job(find_it):
    job = Job(id=123, repository=Repository(), guid='12345')
    job_list = [
        {'id': 111},
        {'id': 222},
    ]

    if find_it:
        job_list.append({'id': 123})
        assert has_job(job, job_list)
    else:
        assert not has_job(job, job_list)


@pytest.mark.parametrize(('find_it',), [(True,), (False,)])
def test_has_line(find_it):
    line = FailureLine(line=123)
    line_list = [
        {'line_number': 111},
        {'line_number': 222},
    ]

    if find_it:
        line_list.append({'line_number': 123})
        assert has_line(line, line_list)
    else:
        assert not has_line(line, line_list)


def test_get_test_failures_no_parent(failure_classifications,
                                     test_repository,
                                     test_job,
                                     text_log_error_lines):
    test_job.result = 'testfailed'
    test_job.save()
    print(test_job.taskcluster_metadata.task_id)

    build_failures = get_test_failures(test_job.push)
    need_investigation = build_failures['needInvestigation']

    assert len(need_investigation) == 1
    assert len(need_investigation[0]['failJobs']) == 1
    assert len(need_investigation[0]['passJobs']) == 0
    assert not need_investigation[0]['failedInParent']


def test_get_test_failures_with_parent(failure_classifications,
                                       test_repository,
                                       test_job,
                                       mock_log_parser,
                                       text_log_error_lines):
    test_job.result = 'testfailed'
    test_job.save()

    parent_push = Push.objects.create(
        revision='abcdef77949168d16c03a4cba167678b7ab65f76',
        repository=test_repository,
        author='foo@bar.baz',
        time=datetime.datetime.now()
    )
    parent_job = Job.objects.first()
    parent_job.pk = None
    parent_job.push = parent_push
    parent_job.guid = 'wazzon chokey?'
    parent_job.save()
    TaskclusterMetadata.objects.create(
        job=parent_job,
        task_id='V3SVuxO8TFy37En_6HcXLs',
        retry_id=0
    )

    create_lines(parent_job, [(test_line, {})])

    build_failures = get_test_failures(test_job.push, parent_push)
    need_investigation = build_failures['needInvestigation']

    assert len(need_investigation) == 1
    assert len(need_investigation[0]['failJobs']) == 1
    assert len(need_investigation[0]['passJobs']) == 0
    assert need_investigation[0]['failedInParent']
