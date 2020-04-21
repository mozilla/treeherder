from django.core.management import call_command

from treeherder.model.models import FailureLine, TextLogError

from ..autoclassify.utils import create_failure_lines, create_text_log_errors, group_line, test_line


def test_crossreference_error_lines(test_job):
    lines = [
        (test_line, {}),
        (test_line, {"subtest": "subtest2"}),
        (test_line, {"status": "TIMEOUT"}),
        (test_line, {"expected": "ERROR"}),
        (test_line, {"message": "message2"}),
    ]

    create_failure_lines(test_job, lines)
    create_text_log_errors(test_job, lines)

    call_command('crossreference_error_lines', str(test_job.id))

    error_lines = TextLogError.objects.filter(step__job=test_job).all()

    failure_lines = FailureLine.objects.all()
    assert len(failure_lines) == len(lines)

    for failure_line, error_line in zip(failure_lines, error_lines):
        assert error_line.metadata.failure_line == failure_line
        assert error_line.metadata.best_is_verified is False
        assert error_line.metadata.best_classification is None


def test_crossreference_error_lines_truncated(test_job):
    lines = [
        (test_line, {}),
        (test_line, {"subtest": "subtest2"}),
        (test_line, {"status": "TIMEOUT"}),
        (test_line, {"expected": "ERROR"}),
        (test_line, {"message": "message2"}),
    ]

    create_text_log_errors(test_job, lines)
    create_failure_lines(test_job, lines[:-1] + [({"action": "truncated"}, {})])

    call_command('crossreference_error_lines', str(test_job.id))

    error_lines = TextLogError.objects.filter(step__job=test_job).all()
    failure_lines = FailureLine.objects.all()

    for failure_line, error_line in zip(failure_lines[: len(failure_lines) - 1], error_lines):
        assert error_line.metadata.failure_line == failure_line
        assert error_line.metadata.best_is_verified is False
        assert error_line.metadata.best_classification is None


def test_crossreference_error_lines_missing(test_job):
    lines = [
        (test_line, {}),
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

    for failure_line, error_line in zip(failure_lines, error_lines[1:]):
        assert error_line.metadata.failure_line == failure_line
        assert error_line.metadata.best_is_verified is False
        assert error_line.metadata.best_classification is None


def test_crossreference_error_lines_leading_groups(test_job):
    lines = [
        (group_line, {}),
        (test_line, {}),
        (test_line, {"subtest": "subtest2"}),
        (test_line, {"status": "TIMEOUT"}),
        (test_line, {"expected": "ERROR"}),
        (test_line, {"message": "message2"}),
    ]

    create_failure_lines(test_job, lines)
    create_text_log_errors(test_job, lines)

    call_command('crossreference_error_lines', str(test_job.id))

    error_lines = TextLogError.objects.filter(step__job=test_job).all()

    failure_lines = FailureLine.objects.all()
    assert len(failure_lines) == len(lines)

    for failure_line, error_line in zip(failure_lines[1:], error_lines):
        assert error_line.metadata.failure_line == failure_line
        assert error_line.metadata.best_is_verified is False
        assert error_line.metadata.best_classification is None
