from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from tests.autoclassify.utils import (create_failure_lines,
                                      create_text_log_errors,
                                      test_line)
from treeherder.autoclassify.detectors import ManualDetector
from treeherder.model.models import (BugJobMap,
                                     ClassifiedFailure,
                                     FailureLine,
                                     Job,
                                     JobNote,
                                     Matcher,
                                     MatcherManager,
                                     TextLogError,
                                     TextLogErrorMetadata)
from treeherder.model.search import TestFailureLine


def test_get_error(text_log_errors_failure_lines):
    """
    test getting a single failure line
    """
    text_log_errors, failure_lines = text_log_errors_failure_lines

    client = APIClient()
    resp = client.get(
        reverse("text-log-error-detail", kwargs={"pk": text_log_errors[0].id}))

    assert resp.status_code == 200

    data = resp.json()

    assert isinstance(data, object)
    exp_error_keys = ["id", "line", "line_number", "matches",
                      "classified_failures", "bug_suggestions", "metadata"]

    assert set(data.keys()) == set(exp_error_keys)

    exp_meta_keys = ["text_log_error", "failure_line", "best_classification",
                     "best_is_verified"]
    assert set(data["metadata"].keys()) == set(exp_meta_keys)


def test_update_error_verify(test_repository,
                             text_log_errors_failure_lines,
                             classified_failures,
                             test_user):

    text_log_errors, failure_lines = text_log_errors_failure_lines
    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    error_line = text_log_errors[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False
    assert error_line.metadata.failure_line == failure_line
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    body = {"best_classification": classified_failures[0].id}

    resp = client.put(
        reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()
    error_line.metadata.refresh_from_db()

    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified

    es_line = TestFailureLine.get(failure_line.id, routing=failure_line.test)
    assert es_line.best_classification == classified_failures[0].id
    assert es_line.best_is_verified


def test_update_error_replace(test_repository,
                              text_log_errors_failure_lines,
                              classified_failures,
                              test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    text_log_errors, failure_lines = text_log_errors_failure_lines
    failure_line = failure_lines[0]
    error_line = text_log_errors[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False
    assert error_line.metadata.failure_line == failure_line
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    body = {"best_classification": classified_failures[1].id}

    resp = client.put(
        reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()
    error_line.metadata.refresh_from_db()

    assert failure_line.best_classification == classified_failures[1]
    assert failure_line.best_is_verified
    assert len(failure_line.classified_failures.all()) == 2
    assert error_line.metadata.failure_line == failure_line
    assert error_line.metadata.best_classification == classified_failures[1]
    assert error_line.metadata.best_is_verified

    expected_matcher = Matcher.objects.get(name="ManualDetector")
    assert failure_line.matches.get(classified_failure_id=classified_failures[1].id).matcher == expected_matcher
    assert error_line.matches.get(classified_failure_id=classified_failures[1].id).matcher == expected_matcher


def test_update_error_mark_job(test_job,
                               text_log_errors_failure_lines,
                               classified_failures,
                               test_user):

    text_log_errors, failure_lines = text_log_errors_failure_lines

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    classified_failures[1].bug_number = 1234
    classified_failures[1].save()

    for text_log_error, failure_line in zip(text_log_errors, failure_lines):

        assert failure_line.best_is_verified is False
        assert text_log_error.metadata.best_is_verified is False

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("text-log-error-detail", kwargs={"pk": text_log_error.id}),
                          body, format="json")

        assert resp.status_code == 200

        failure_line.refresh_from_db()
        text_log_error.metadata.refresh_from_db()

        assert failure_line.best_classification == classified_failures[1]
        assert failure_line.best_is_verified
        assert text_log_error.metadata.best_classification == classified_failures[1]
        assert text_log_error.metadata.best_is_verified

    assert test_job.is_fully_verified()

    # should only be one, will assert if that isn't the case
    note = JobNote.objects.get(job=test_job)
    assert note.failure_classification.id == 4
    assert note.user == test_user
    job_bugs = BugJobMap.objects.filter(job=test_job)
    assert job_bugs.count() == 1
    assert job_bugs[0].bug_id == 1234


def test_update_error_mark_job_with_human_note(test_job,
                                               text_log_errors_failure_lines,
                                               classified_failures, test_user):

    text_log_errors, failure_lines = text_log_errors_failure_lines
    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    JobNote.objects.create(job=test_job,
                           failure_classification_id=4,
                           user=test_user,
                           text="note")

    for error_line in text_log_errors:

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
                          body, format="json")

        assert resp.status_code == 200

    assert test_job.is_fully_verified()

    # should only be one, will assert if that isn't the case
    note = JobNote.objects.get(job=test_job)
    assert note.failure_classification.id == 4
    assert note.user == test_user


def test_update_error_line_mark_job_with_auto_note(test_job,
                                                   mock_autoclassify_jobs_true,
                                                   text_log_errors_failure_lines,
                                                   classified_failures,
                                                   test_user):

    text_log_errors, failure_lines = text_log_errors_failure_lines
    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    JobNote.objects.create(job=test_job,
                           failure_classification_id=7,
                           text="note")

    for text_log_error in text_log_errors:
        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("text-log-error-detail", kwargs={"pk": text_log_error.id}),
                          body, format="json")

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


def test_update_errors(mock_autoclassify_jobs_true,
                       test_repository,
                       text_log_errors_failure_lines,
                       classified_failures,
                       eleven_jobs_stored,
                       test_user):

    jobs = (Job.objects.get(id=1), Job.objects.get(id=2))

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
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

    for text_log_error, failure_line in zip(text_log_errors, failure_lines):
        assert text_log_error.metadata.best_is_verified is False
        assert failure_line.best_is_verified is False

    body = [{"id": failure_line.id,
             "best_classification": classified_failures[1].id}
            for failure_line in failure_lines]
    resp = client.put(reverse("text-log-error-list"), body, format="json")

    assert resp.status_code == 200

    for text_log_error, failure_line in zip(text_log_errors, failure_lines):
        text_log_error.metadata.refresh_from_db()
        failure_line.refresh_from_db()
        assert failure_line.best_classification == classified_failures[1]
        assert failure_line.best_is_verified
        assert text_log_error.metadata.best_classification == classified_failures[1]
        assert text_log_error.metadata.best_is_verified

    for job in jobs:
        assert job.is_fully_verified()

        # will assert if we don't have exactly one job, which is what we want
        note = JobNote.objects.get(job=job)
        assert note.failure_classification.id == 4
        assert note.user == test_user


def test_update_error_ignore(test_job, text_log_errors_failure_lines,
                             classified_failures, test_user):

    text_log_errors, failure_lines = text_log_errors_failure_lines
    client = APIClient()
    client.force_authenticate(user=test_user)

    MatcherManager.register_detector(ManualDetector)

    text_log_error = text_log_errors[0]
    failure_line = failure_lines[0]
    assert text_log_error.metadata.best_classification == classified_failures[0]
    assert text_log_error.metadata.best_is_verified is False
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": test_job.repository.name,
            "best_classification": None}

    resp = client.put(
        reverse("text-log-error-detail", kwargs={"pk": text_log_error.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()
    text_log_error.metadata.refresh_from_db()

    assert failure_line.best_classification is None
    assert failure_line.best_is_verified
    assert text_log_error.metadata.best_classification is None
    assert text_log_error.metadata.best_is_verified


def test_update_error_all_ignore_mark_job(test_job,
                                          mock_autoclassify_jobs_true,
                                          text_log_errors_failure_lines,
                                          classified_failures,
                                          test_user):

    text_log_errors, failure_lines = text_log_errors_failure_lines
    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == test_job.guid]
    job_text_log_errors = [error for error in text_log_errors if
                           error.step.job == test_job]

    for error_line, failure_line in zip(job_text_log_errors, job_failure_lines):
        error_line.best_is_verified = False
        error_line.best_classification = None
        failure_line.best_is_verified = False
        failure_line.best_classification = None

    assert JobNote.objects.count() == 0

    for error_line, failure_line in zip(job_text_log_errors, job_failure_lines):

        assert error_line.metadata.best_is_verified is False
        assert failure_line.best_is_verified is False

        body = {"best_classification": None}

        resp = client.put(reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
                          body, format="json")

        assert resp.status_code == 200

        error_line.metadata.refresh_from_db()
        failure_line.refresh_from_db()

        assert error_line.metadata.best_classification is None
        assert error_line.metadata.best_is_verified
        assert failure_line.best_classification is None
        assert failure_line.best_is_verified

    assert test_job.is_fully_verified()

    assert JobNote.objects.count() == 1


def test_update_error_partial_ignore_mark_job(test_job,
                                              mock_autoclassify_jobs_true,
                                              text_log_errors_failure_lines,
                                              classified_failures,
                                              test_user):

    text_log_errors, failure_lines = text_log_errors_failure_lines
    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    for i, (error_line, failure_line) in enumerate(zip(text_log_errors, failure_lines)):

        assert error_line.metadata.best_is_verified is False
        assert failure_line.best_is_verified is False

        body = {"best_classification": None if i == 0 else classified_failures[0].id}

        resp = client.put(reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
                          body, format="json")

        assert resp.status_code == 200

        error_line.metadata.refresh_from_db()
        failure_line.refresh_from_db()

        if i == 0:
            assert error_line.metadata.best_classification is None
            assert failure_line.best_classification is None
        else:
            assert error_line.metadata.best_classification == classified_failures[0]
            assert failure_line.best_classification == classified_failures[0]
        assert failure_line.best_is_verified

    assert test_job.is_fully_verified()

    # will assert if we don't have exactly one note for this job, which is
    # what we want
    note = JobNote.objects.get(job=test_job)
    assert note.failure_classification.id == 4
    assert note.user == test_user


def test_update_error_verify_bug(test_repository,
                                 text_log_errors_failure_lines,
                                 classified_failures,
                                 test_user):

    MatcherManager.register_detector(ManualDetector)

    text_log_errors, failure_lines = text_log_errors_failure_lines
    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    error_line = text_log_errors[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False
    assert error_line.metadata.failure_line == failure_line
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    body = {"bug_number": classified_failures[0].bug_number}

    resp = client.put(
        reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()
    error_line.metadata.refresh_from_db()

    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified

    es_line = TestFailureLine.get(failure_line.id, routing=failure_line.test)
    assert es_line.best_classification == classified_failures[0].id
    assert es_line.best_is_verified


def test_update_error_verify_new_bug(test_repository,
                                     text_log_errors_failure_lines,
                                     classified_failures,
                                     test_user):

    MatcherManager.register_detector(ManualDetector)

    text_log_errors, failure_lines = text_log_errors_failure_lines
    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    error_line = text_log_errors[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False
    assert error_line.metadata.failure_line == failure_line
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    assert 78910 not in [item.bug_number for item in classified_failures]
    body = {"bug_number": 78910}

    resp = client.put(
        reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()
    error_line.metadata.refresh_from_db()

    assert failure_line.best_classification not in classified_failures
    assert failure_line.best_classification.bug_number == 78910
    assert failure_line.best_is_verified
    assert error_line.metadata.best_classification not in classified_failures
    assert error_line.metadata.best_is_verified
    assert error_line.metadata.best_classification.bug_number == 78910


def test_update_error_verify_ignore_now(test_repository,
                                        text_log_errors_failure_lines,
                                        classified_failures,
                                        test_user):

    MatcherManager.register_detector(ManualDetector)

    text_log_errors, failure_lines = text_log_errors_failure_lines
    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    error_line = text_log_errors[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False
    assert error_line.metadata.failure_line == failure_line
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    assert 78910 not in [item.bug_number for item in classified_failures]
    body = {}

    resp = client.put(
        reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()
    error_line.metadata.refresh_from_db()

    assert failure_line.best_classification is None
    assert failure_line.best_is_verified
    assert error_line.metadata.best_classification is None
    assert error_line.metadata.best_is_verified


def test_update_error_change_bug(test_repository,
                                 text_log_errors_failure_lines,
                                 classified_failures,
                                 test_user):

    MatcherManager.register_detector(ManualDetector)

    text_log_errors, failure_lines = text_log_errors_failure_lines
    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    error_line = text_log_errors[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False
    assert error_line.metadata.failure_line == failure_line
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    assert 78910 not in [item.bug_number for item in classified_failures]
    body = {"best_classification": classified_failures[0].id,
            "bug_number": 78910}

    resp = client.put(
        reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
        body, format="json")

    assert resp.status_code == 200

    classified_failures[0].refresh_from_db()
    failure_line.refresh_from_db()
    error_line.metadata.refresh_from_db()

    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_classification.bug_number == 78910
    assert failure_line.best_is_verified
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified
    assert error_line.metadata.best_classification.bug_number == 78910


def test_update_error_bug_change_cf(test_repository,
                                    text_log_errors_failure_lines,
                                    classified_failures,
                                    test_user):

    MatcherManager.register_detector(ManualDetector)

    text_log_errors, failure_lines = text_log_errors_failure_lines
    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    error_line = text_log_errors[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False
    assert error_line.metadata.failure_line == failure_line
    assert error_line.metadata.best_classification == classified_failures[0]
    assert error_line.metadata.best_is_verified is False

    assert 78910 not in [item.bug_number for item in classified_failures]
    classified_failures[1].bug_number = 78910
    classified_failures[1].save()

    body = {"best_classification": classified_failures[0].id,
            "bug_number": 78910}

    resp = client.put(
        reverse("text-log-error-detail", kwargs={"pk": error_line.id}),
        body, format="json")

    assert resp.status_code == 200

    classified_failures[1].refresh_from_db()
    failure_line.refresh_from_db()
    error_line.metadata.refresh_from_db()

    assert failure_line.best_classification == classified_failures[1]
    assert failure_line.best_classification.bug_number == 78910
    assert failure_line.best_is_verified
    assert error_line.metadata.best_classification == classified_failures[1]
    assert error_line.metadata.best_is_verified
    assert error_line.metadata.best_classification.bug_number == 78910
    assert ClassifiedFailure.objects.count() == len(classified_failures) - 1
