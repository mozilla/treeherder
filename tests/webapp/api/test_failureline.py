from django.core.urlresolvers import reverse

from tests.autoclassify.utils import (create_failure_lines,
                                      create_text_log_errors,
                                      test_line)
from treeherder.model.models import (BugJobMap,
                                     Bugscache,
                                     FailureLine,
                                     Job,
                                     JobNote,
                                     TextLogError,
                                     TextLogErrorMetadata)
from treeherder.services.elasticsearch import get_document


def test_get_failure_line(client, failure_lines):
    """
    test getting a single failure line
    """
    resp = client.get(
        reverse("failure-line-detail", kwargs={"pk": failure_lines[0].id}))

    assert resp.status_code == 200

    failure_line = resp.json()

    assert isinstance(failure_line, object)
    exp_failure_keys = ["id", "job_guid", "repository", "job_log",
                        "action", "line", "test", "subtest", "status", "expected", "message",
                        "signature", "level", "created", "modified", "matches",
                        "best_classification", "best_is_verified", "classified_failures",
                        "unstructured_bugs"]

    assert set(failure_line.keys()) == set(exp_failure_keys)


def test_update_failure_line_verify(test_repository,
                                    text_log_errors_failure_lines,
                                    classified_failures,
                                    client,
                                    test_user):

    text_log_errors, _ = text_log_errors_failure_lines
    client.force_authenticate(user=test_user)

    error_line = text_log_errors[0]
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    body = {"project": test_repository.name,
            "best_classification": classified_failures[0].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": error_line.metadata.failure_line.id}),
        body)

    assert resp.status_code == 200

    error_line.metadata.refresh_from_db()
    error_line.refresh_from_db()

    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified

    es_line = get_document(error_line.metadata.failure_line.id)
    assert es_line['best_classification'] == classified_failures[0].id
    assert es_line['best_is_verified']


def test_update_failure_line_replace(test_repository,
                                     text_log_errors_failure_lines,
                                     classified_failures,
                                     client,
                                     test_user):

    client.force_authenticate(user=test_user)

    text_log_errors, _ = text_log_errors_failure_lines
    error_line = text_log_errors[0]
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    body = {"project": test_repository.name,
            "best_classification": classified_failures[1].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": error_line.metadata.failure_line.id}),
        body)

    assert resp.status_code == 200

    error_line.metadata.refresh_from_db()
    error_line.refresh_from_db()
    classified_failure = classified_failures[1]

    assert error_line.classified_failures.count() == 2
    assert error_line.metadata.best_classification == classified_failure
    assert error_line.metadata.best_is_verified

    expected_matcher = "ManualDetector"
    assert error_line.matches.get(classified_failure=classified_failure).matcher_name == expected_matcher


def test_update_failure_line_mark_job(test_repository, test_job,
                                      text_log_errors_failure_lines,
                                      classified_failures,
                                      client,
                                      test_user):

    text_log_errors, _ = text_log_errors_failure_lines

    client.force_authenticate(user=test_user)

    bug = Bugscache.objects.create(id=1234,
                                   status="NEW",
                                   modified="2014-01-01 00:00:00",
                                   summary="test")

    classified_failures[1].bug_number = bug.id
    classified_failures[1].save()

    for text_log_error in text_log_errors:
        assert text_log_error.metadata.best_is_verified is False

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": text_log_error.metadata.failure_line.id}),
                          body)

        assert resp.status_code == 200

        text_log_error.refresh_from_db()
        text_log_error.metadata.refresh_from_db()

        assert text_log_error.metadata.best_classification == classified_failures[1]
        assert text_log_error.metadata.best_is_verified

    assert test_job.is_fully_verified()

    # should only be one, will assert if that isn't the case
    note = JobNote.objects.get(job=test_job)
    assert note.failure_classification.id == 4
    assert note.user == test_user
    job_bugs = BugJobMap.objects.filter(job=test_job)
    assert job_bugs.count() == 1
    assert job_bugs[0].bug_id == bug.id


def test_update_failure_line_mark_job_with_human_note(test_job,
                                                      text_log_errors_failure_lines,
                                                      classified_failures,
                                                      client,
                                                      test_user):

    _, failure_lines = text_log_errors_failure_lines

    client.force_authenticate(user=test_user)

    JobNote.objects.create(job=test_job,
                           failure_classification_id=4,
                           user=test_user,
                           text="note")

    for failure_line in failure_lines:

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body)

        assert resp.status_code == 200

    assert test_job.is_fully_verified()

    # should only be one, will assert if that isn't the case
    note = JobNote.objects.get(job=test_job)
    assert note.failure_classification.id == 4
    assert note.user == test_user


def test_update_failure_line_mark_job_with_auto_note(test_job,
                                                     mock_autoclassify_jobs_true,
                                                     test_repository,
                                                     text_log_errors_failure_lines,
                                                     classified_failures,
                                                     client,
                                                     test_user):

    _, failure_lines = text_log_errors_failure_lines

    client.force_authenticate(user=test_user)

    JobNote.objects.create(job=test_job,
                           failure_classification_id=7,
                           text="note")

    for failure_line in failure_lines:
        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body)

        assert resp.status_code == 200

    assert test_job.is_fully_verified()

    notes = JobNote.objects.filter(job=test_job).order_by('-created')
    assert notes.count() == 2

    assert notes[0].failure_classification.id == 4
    assert notes[0].user == test_user
    assert notes[0].text == ''

    assert notes[1].failure_classification.id == 7
    assert not notes[1].user
    assert notes[1].text == "note"


def test_update_failure_lines(mock_autoclassify_jobs_true,
                              test_repository,
                              classified_failures,
                              eleven_jobs_stored,
                              client,
                              test_user):

    jobs = (Job.objects.get(id=1), Job.objects.get(id=2))

    client.force_authenticate(user=test_user)

    lines = [(test_line, {}),
             (test_line, {"subtest": "subtest2"})]
    new_failure_lines = create_failure_lines(jobs[1], lines)
    new_text_log_errors = create_text_log_errors(jobs[1], lines)

    for text_log_error, failure_line in zip(new_text_log_errors,
                                            new_failure_lines):
        TextLogErrorMetadata.objects.create(text_log_error=text_log_error,
                                            failure_line=failure_line)

    failure_lines = FailureLine.objects.filter(
        job_guid__in=[job.guid for job in jobs]).all()
    text_log_errors = TextLogError.objects.filter(
        step__job__in=jobs).all()

    for text_log_error in text_log_errors:
        assert text_log_error.metadata.best_is_verified is False

    body = [{"id": failure_line.id,
             "best_classification": classified_failures[1].id}
            for failure_line in failure_lines]
    resp = client.put(reverse("failure-line-list"), body)

    assert resp.status_code == 200

    for text_log_error in text_log_errors:
        text_log_error.refresh_from_db()
        text_log_error.metadata.refresh_from_db()
        assert text_log_error.metadata.best_classification == classified_failures[1]
        assert text_log_error.metadata.best_is_verified

    for job in jobs:
        assert job.is_fully_verified()

        # will assert if we don't have exactly one job, which is what we want
        note = JobNote.objects.get(job=job)
        assert note.failure_classification.id == 4
        assert note.user == test_user


def test_update_failure_line_ignore(test_job,
                                    test_repository,
                                    text_log_errors_failure_lines,
                                    classified_failures,
                                    client,
                                    test_user):

    text_log_errors, _ = text_log_errors_failure_lines
    client.force_authenticate(user=test_user)

    text_log_error = text_log_errors[0]
    assert text_log_error.metadata.best_classification == classified_failures[0]
    assert text_log_error.metadata.best_is_verified is False

    body = {"project": test_job.repository.name,
            "best_classification": None}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": text_log_error.metadata.failure_line.id}),
        body)

    assert resp.status_code == 200

    text_log_error.refresh_from_db()
    text_log_error.metadata.refresh_from_db()

    assert text_log_error.metadata.best_classification is None
    assert text_log_error.metadata.best_is_verified


def test_update_failure_line_all_ignore_mark_job(test_job,
                                                 mock_autoclassify_jobs_true,
                                                 text_log_errors_failure_lines,
                                                 classified_failures,
                                                 client,
                                                 test_user):

    text_log_errors, _ = text_log_errors_failure_lines

    client.force_authenticate(user=test_user)

    job_text_log_errors = [error for error in text_log_errors if
                           error.step.job == test_job]

    for error_line in job_text_log_errors:
        error_line.metadata.best_is_verified = False
        error_line.metadata.best_classification = None

    assert JobNote.objects.count() == 0

    for error_line in job_text_log_errors:
        assert error_line.metadata.best_is_verified is False

        body = {"best_classification": None}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": error_line.metadata.failure_line.id}),
                          body)

        assert resp.status_code == 200

        error_line.refresh_from_db()
        error_line.metadata.refresh_from_db()

        assert error_line.metadata.best_classification is None
        assert error_line.metadata.best_is_verified

    assert test_job.is_fully_verified()

    assert JobNote.objects.count() == 1


def test_update_failure_line_partial_ignore_mark_job(test_job,
                                                     mock_autoclassify_jobs_true,
                                                     text_log_errors_failure_lines,
                                                     classified_failures,
                                                     client,
                                                     test_user):

    text_log_errors, _ = text_log_errors_failure_lines

    client.force_authenticate(user=test_user)

    for i, error_line in enumerate(text_log_errors):
        assert error_line.metadata.best_is_verified is False

        body = {"best_classification": None if i == 0 else classified_failures[0].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": error_line.metadata.failure_line.id}),
                          body)

        assert resp.status_code == 200

        error_line.refresh_from_db()
        error_line.metadata.refresh_from_db()

        if i == 0:
            assert error_line.metadata.best_classification is None
        else:
            assert error_line.metadata.best_classification == classified_failures[0]
        assert error_line.metadata.best_is_verified

    assert test_job.is_fully_verified()

    # will assert if we don't have exactly one note for this job, which is
    # what we want
    note = JobNote.objects.get(job=test_job)
    assert note.failure_classification.id == 4
    assert note.user == test_user
