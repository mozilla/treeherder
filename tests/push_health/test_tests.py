import pytest

from treeherder.model.models import (FailureLine,
                                     Job,
                                     Repository)
from treeherder.push_health.tests import (has_job,
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
