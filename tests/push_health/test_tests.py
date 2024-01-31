import pytest

from treeherder.model.models import FailureLine, Job, Repository
from treeherder.push_health.tests import get_test_failures, get_test_failure_jobs, has_job, has_line


@pytest.mark.parametrize(("find_it",), [(True,), (False,)])
def test_has_job(find_it):
    job = Job(id=123, repository=Repository(), guid="12345")
    job_list = [
        {"id": 111},
        {"id": 222},
    ]

    if find_it:
        job_list.append({"id": 123})
        assert has_job(job, job_list)
    else:
        assert not has_job(job, job_list)


@pytest.mark.parametrize(("find_it",), [(True,), (False,)])
def test_has_line(find_it):
    line = FailureLine(line=123)
    line_list = [
        {"line_number": 111},
        {"line_number": 222},
    ]

    if find_it:
        line_list.append({"line_number": 123})
        assert has_line(line, line_list)
    else:
        assert not has_line(line, line_list)


def test_get_test_failures(
    failure_classifications, test_repository, test_job, text_log_error_lines
):
    test_job.result = "testfailed"
    test_job.save()

    result_status, jobs = get_test_failure_jobs(test_job.push)
    result, build_failures = get_test_failures(test_job.push, jobs, result_status)
    need_investigation = build_failures["needInvestigation"]

    assert result == "fail"
    assert len(need_investigation) == 1
    assert len(jobs[need_investigation[0]["jobName"]]) == 1
