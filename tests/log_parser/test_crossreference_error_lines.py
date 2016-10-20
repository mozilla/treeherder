from django.core.management import call_command

from treeherder.model.models import (FailureLine,
                                     TextLogError,
                                     TextLogSummary,
                                     TextLogSummaryLine)

from ..autoclassify.utils import (create_failure_lines,
                                  create_text_log_errors,
                                  test_line)


def test_crossreference_error_lines(test_job):
    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"})]

    create_failure_lines(test_job, lines)
    create_text_log_errors(test_job, lines)

    call_command('crossreference_error_lines', str(test_job.id))

    error_lines = TextLogError.objects.filter(step__job=test_job).all()
    summary = TextLogSummary.objects.all()
    assert len(summary) == 1
    summary = summary[0]

    assert summary.repository == test_job.repository
    assert summary.job_guid == test_job.guid

    summary_lines = TextLogSummaryLine.objects.all()
    assert len(summary_lines) == len(lines)

    failure_lines = FailureLine.objects.all()
    assert len(failure_lines) == len(lines)

    for i, (failure_line, error_line, summary_line) in enumerate(
            zip(failure_lines, error_lines, summary_lines)):
        assert summary_line.summary == summary
        assert summary_line.line_number == i
        assert summary_line.failure_line == failure_line
        assert summary_line.verified is False
        assert summary_line.bug_number is None
        assert error_line.metadata.failure_line == failure_line
        assert error_line.metadata.best_is_verified is False
        assert error_line.metadata.best_classification is None


def test_crossreference_error_lines_truncated(test_job):
    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"}),
             ]

    create_failure_lines(test_job,
                         lines[:-1] + [({"action": "truncated"}, {})])
    create_text_log_errors(test_job, lines)

    call_command('crossreference_error_lines', str(test_job.id))

    summary_lines = TextLogSummaryLine.objects.all()
    assert len(summary_lines) == len(lines)
    assert summary_lines[len(summary_lines) - 1].failure_line is None


def test_crossreference_error_lines_missing(test_job):
    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"}),
             ]

    create_failure_lines(test_job, lines[1:])
    create_text_log_errors(test_job, lines)

    call_command('crossreference_error_lines', str(test_job.id))

    failure_lines = FailureLine.objects.all()
    error_lines = TextLogError.objects.filter(step__job=test_job).all()
    summary_lines = TextLogSummaryLine.objects.all()
    summary = TextLogSummary.objects.all()[0]
    assert len(summary_lines) == len(failure_lines) + 1

    summary_line = summary_lines[0]
    error_line = error_lines[0]
    assert summary_line.summary == summary
    assert summary_line.line_number == 0
    assert summary_line.failure_line is None
    assert summary_line.verified is False
    assert summary_line.bug_number is None

    for i, (failure_line, error_line, summary_line) in enumerate(
            zip(failure_lines, error_lines[1:], summary_lines[1:])):
        assert summary_line.summary == summary
        assert summary_line.line_number == i + 1
        assert summary_line.failure_line == failure_line
        assert summary_line.verified is False
        assert summary_line.bug_number is None
        assert error_line.metadata.failure_line == failure_line
        assert error_line.metadata.best_is_verified is False
        assert error_line.metadata.best_classification is None
