from django.core.management import call_command

from treeherder.model.models import (FailureLine,
                                     TextLogError)

from ..autoclassify.utils import (create_bug_suggestions_failures,
                                  create_failure_lines,
                                  create_text_log_errors,
                                  test_line)


def test_crossreference_error_lines(test_repository, activate_responses, jm,
                                    eleven_jobs_stored):
    job = jm.get_job(1)[0]

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"})]

    create_failure_lines(test_repository, job["job_guid"], lines)
    create_text_log_errors(test_repository.name, job["id"], lines)
    create_bug_suggestions_failures(test_repository.name, job, lines)

    call_command('crossreference_error_lines', job['job_guid'])

    errors = TextLogError.objects.all()
    assert len(errors) == len(lines)

    failure_lines = FailureLine.objects.all()
    assert len(failure_lines) == len(lines)

    for i, (failure_line, error) in enumerate(zip(failure_lines, errors)):
        assert error.line_number == i
        assert error.failure_line == failure_line
        assert error.verified is False
        assert error.bug_number is None


def test_crossreference_error_lines_truncated(test_repository, activate_responses, jm,
                                              eleven_jobs_stored):
    job = jm.get_job(1)[0]

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"}),
             ]

    create_failure_lines(
        test_repository, job["job_guid"],
        lines[:-1] + [({"action": "truncated"}, {})])
    create_text_log_errors(test_repository.name, job["id"], lines)
    create_bug_suggestions_failures(test_repository.name, job, lines)

    call_command('crossreference_error_lines', job['job_guid'])

    errors = TextLogError.objects.all()
    assert len(errors) == len(lines)
    assert errors[len(errors) - 1].failure_line is None


def test_crossreference_error_lines_missing(test_repository, activate_responses, jm,
                                            eleven_jobs_stored):
    job = jm.get_job(1)[0]

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"}),
             (test_line, {"status": "TIMEOUT"}),
             (test_line, {"expected": "ERROR"}),
             (test_line, {"message": "message2"}),
             ]

    create_failure_lines(test_repository, job["job_guid"], lines[1:])
    create_text_log_errors(test_repository.name, job["id"], lines)
    create_bug_suggestions_failures(test_repository.name, job, lines)

    call_command('crossreference_error_lines', job['job_guid'])

    failure_lines = FailureLine.objects.all()
    errors = TextLogError.objects.all()
    assert len(errors) == len(failure_lines) + 1

    error = errors[0]
    assert error.line_number == 0
    assert error.failure_line is None
    assert error.verified is False
    assert error.bug_number is None

    for i, (failure_line, error) in enumerate(zip(failure_lines, errors[1:])):
        assert error.line_number == i + 1
        assert error.failure_line == failure_line
        assert error.verified is False
        assert error.bug_number is None
