from django.core.management import call_command

from treeherder.model.models import (FailureLine,
                                     Repository,
                                     RepositoryGroup,
                                     TextLogSummary,
                                     TextLogSummaryLine)

from ..autoclassify.utils import (create_bug_suggestions_failures,
                                  create_failure_lines,
                                  create_summary_lines_failures,
                                  test_line)


def test_crossreference_error_lines(activate_responses, jm,
                                    eleven_jobs_stored, initial_data):
    job = jm.get_job(1)[0]

    repository_group = RepositoryGroup.objects.create(name="repo_group")
    repository = Repository.objects.create(name=jm.project,
                                           repository_group=repository_group)

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"})]

    create_failure_lines(repository, job["job_guid"], lines)

    create_summary_lines_failures(repository.name, job, lines)
    create_bug_suggestions_failures(repository.name, job, lines)

    call_command('crossreference_error_lines', repository.name, job['job_guid'])

    summary = TextLogSummary.objects.all()
    assert len(summary) == 1
    summary = summary[0]

    assert summary.repository == repository
    assert summary.job_guid == job["job_guid"]

    summary_lines = TextLogSummaryLine.objects.all()
    assert len(summary_lines) == len(lines)

    failure_lines = FailureLine.objects.all()
    assert len(failure_lines) == len(lines)

    for i, (failure_line, summary_line) in enumerate(zip(failure_lines, summary_lines)):
        assert summary_line.summary == summary
        assert summary_line.line_number == i
        assert summary_line.failure_line == failure_line
        assert summary_line.verified is False
        assert summary_line.bug_number is None


def test_crossreference_error_lines_truncated(activate_responses, jm,
                                              eleven_jobs_stored, initial_data):
    job = jm.get_job(1)[0]

    repository_group = RepositoryGroup.objects.create(name="repo_group")
    repository = Repository.objects.create(name=jm.project,
                                           repository_group=repository_group)

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"}),
             ]

    create_failure_lines(repository, job["job_guid"],
                         lines[:-1] + [({"action": "truncated"}, {})])

    create_summary_lines_failures(repository.name, job, lines)
    create_bug_suggestions_failures(repository.name, job, lines)

    call_command('crossreference_error_lines', repository.name, job['job_guid'])

    summary_lines = TextLogSummaryLine.objects.all()
    assert len(summary_lines) == len(lines)
    assert summary_lines[len(summary_lines) - 1].failure_line is None


def test_crossreference_error_lines_missing(activate_responses, jm,
                                            eleven_jobs_stored, initial_data):
    job = jm.get_job(1)[0]

    repository_group = RepositoryGroup.objects.create(name="repo_group")
    repository = Repository.objects.create(name=jm.project,
                                           repository_group=repository_group)

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"}),
             ]

    create_failure_lines(repository, job["job_guid"], lines[1:])

    create_summary_lines_failures(repository.name, job, lines)
    create_bug_suggestions_failures(repository.name, job, lines)

    call_command('crossreference_error_lines', repository.name, job['job_guid'])

    failure_lines = FailureLine.objects.all()
    summary_lines = TextLogSummaryLine.objects.all()
    summary = TextLogSummary.objects.all()[0]
    assert len(summary_lines) == len(failure_lines) + 1

    summary_line = summary_lines[0]
    assert summary_line.summary == summary
    assert summary_line.line_number == 0
    assert summary_line.failure_line is None
    assert summary_line.verified is False
    assert summary_line.bug_number is None

    for i, (failure_line, summary_line) in enumerate(zip(failure_lines, summary_lines[1:])):
        assert summary_line.summary == summary
        assert summary_line.line_number == i + 1
        assert summary_line.failure_line == failure_line
        assert summary_line.verified is False
        assert summary_line.bug_number is None
