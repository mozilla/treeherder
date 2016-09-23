import json

from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from tests.autoclassify.utils import (create_failure_lines,
                                      test_line)
from treeherder.autoclassify.detectors import ManualDetector
from treeherder.model.derived import ArtifactsModel
from treeherder.model.models import (BugJobMap,
                                     FailureLine,
                                     Job,
                                     JobNote,
                                     Matcher,
                                     MatcherManager)
from treeherder.model.search import TestFailureLine


def test_get_failure_line(webapp, failure_lines):
    """
    test getting a single failure line
    """
    resp = webapp.get(
        reverse("failure-line-detail", kwargs={"pk": failure_lines[0].id}))

    assert resp.status_int == 200

    failure_line = resp.json

    assert isinstance(failure_line, object)
    exp_failure_keys = ["id", "job_guid", "repository", "job_log",
                        "action", "line", "test", "subtest", "status", "expected", "message",
                        "signature", "level", "created", "modified", "matches",
                        "best_classification", "best_is_verified", "classified_failures",
                        "unstructured_bugs"]

    assert set(failure_line.keys()) == set(exp_failure_keys)


def test_update_failure_line_verify(test_repository, failure_lines, classified_failures,
                                    test_user):

    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": test_repository.name,
            "best_classification": classified_failures[0].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified

    es_line = TestFailureLine.get(failure_line.id, routing=failure_line.test)
    assert es_line.best_classification == classified_failures[0].id
    assert es_line.best_is_verified


def test_update_failure_line_replace(test_repository, failure_lines,
                                     classified_failures, test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": test_repository.name,
            "best_classification": classified_failures[1].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification == classified_failures[1]
    assert failure_line.best_is_verified
    assert len(failure_line.classified_failures.all()) == 2

    expected_matcher = Matcher.objects.get(name="ManualDetector")
    assert failure_line.matches.get(classified_failure_id=classified_failures[1].id).matcher == expected_matcher


def test_update_failure_line_mark_job(jm, test_job,
                                      mock_autoclassify_jobs_true,
                                      failure_lines,
                                      classified_failures, test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == test_job.guid]

    classified_failures[1].bug_number = 1234
    classified_failures[1].save()

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': test_job.guid}

    with ArtifactsModel(test_job.repository.name) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

    for failure_line in job_failure_lines:

        assert failure_line.best_is_verified is False

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body, format="json")

        assert resp.status_code == 200

        failure_line.refresh_from_db()

        assert failure_line.best_classification == classified_failures[1]
        assert failure_line.best_is_verified

    assert test_job.is_fully_verified()

    # should only be one, will assert if that isn't the case
    note = JobNote.objects.get(job=test_job)
    assert note.failure_classification.id == 4
    assert note.user == test_user
    job_bugs = BugJobMap.objects.filter(job=test_job)
    assert job_bugs.count() == 1
    assert job_bugs[0].bug_id == 1234


def test_update_failure_line_mark_job_with_human_note(test_job,
                                                      mock_autoclassify_jobs_true, jm,
                                                      failure_lines,
                                                      classified_failures, test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job = Job.objects.get(project_specific_id=1)

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == job.guid]

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': job.guid}

    with ArtifactsModel(test_job.repository.name) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

    JobNote.objects.create(job=job,
                           failure_classification_id=4,
                           user=test_user,
                           text="note")

    for failure_line in job_failure_lines:

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body, format="json")

        assert resp.status_code == 200

    assert job.is_fully_verified()

    # should only be one, will assert if that isn't the case
    note = JobNote.objects.get(job=job)
    assert note.failure_classification.id == 4
    assert note.user == test_user


def test_update_failure_line_mark_job_with_auto_note(test_job,
                                                     mock_autoclassify_jobs_true, jm,
                                                     failure_lines,
                                                     classified_failures, test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == test_job.guid]

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': test_job.guid}

    with ArtifactsModel(test_job.repository.name) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

    JobNote.objects.create(job=test_job,
                           failure_classification_id=7,
                           text="note")

    for failure_line in job_failure_lines:

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
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


def test_update_failure_lines(mock_autoclassify_jobs_true, jm,
                              test_job, failure_lines, classified_failures,
                              eleven_jobs_stored, test_user):

    jobs = (test_job,
            Job.objects.get(project_specific_id=2))
    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    create_failure_lines(jobs[1],
                         [(test_line, {}),
                          (test_line, {"subtest": "subtest2"})])

    failure_lines = FailureLine.objects.filter(
        job_guid__in=[job.guid for job in jobs]).all()

    for job in jobs:
        job_failure_lines = FailureLine.objects.filter(job_guid=job.guid).all()
        bs_artifact = {'type': 'json',
                       'name': 'Bug suggestions',
                       'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                            (line.status.upper(), line.message)} for line in
                                           job_failure_lines]),
                       'job_guid': job.guid}

        with ArtifactsModel(jm.project) as artifacts_model:
            artifacts_model.load_job_artifacts([bs_artifact])

    body = [{"id": failure_line.id,
             "best_classification": classified_failures[1].id}
            for failure_line in failure_lines]

    for failure_line in failure_lines:
        assert failure_line.best_is_verified is False

    resp = client.put(reverse("failure-line-list"), body, format="json")

    assert resp.status_code == 200

    for failure_line in failure_lines:
        failure_line.refresh_from_db()
        assert failure_line.best_classification == classified_failures[1]
        assert failure_line.best_is_verified

    for job in jobs:
        assert job.is_fully_verified()

        # will assert if we don't have exactly one job, which is what we want
        note = JobNote.objects.get(job=job)
        assert note.failure_classification.id == 4
        assert note.user == test_user


def test_update_failure_line_ignore(test_job, jm, failure_lines,
                                    classified_failures, test_user):

    client = APIClient()
    client.force_authenticate(user=test_user)

    MatcherManager.register_detector(ManualDetector)

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": test_job.repository.name,
            "best_classification": None}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification is None
    assert failure_line.best_is_verified


def test_update_failure_line_all_ignore_mark_job(test_job,
                                                 mock_autoclassify_jobs_true, jm,
                                                 failure_lines,
                                                 classified_failures,
                                                 test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == test_job.guid]

    for failure_line in job_failure_lines:
        failure_line.best_is_verified = False
        failure_line.best_classification = None

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': test_job.guid}

    with ArtifactsModel(test_job.repository.name) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

    assert JobNote.objects.count() == 0

    for failure_line in job_failure_lines:

        assert failure_line.best_is_verified is False

        body = {"best_classification": None}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body, format="json")

        assert resp.status_code == 200

        failure_line.refresh_from_db()

        assert failure_line.best_classification is None
        assert failure_line.best_is_verified

    assert test_job.is_fully_verified()

    assert JobNote.objects.count() == 1


def test_update_failure_line_partial_ignore_mark_job(test_job,
                                                     mock_autoclassify_jobs_true, jm,
                                                     failure_lines,
                                                     classified_failures,
                                                     test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job = Job.objects.get(project_specific_id=1)
    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == job.guid]
    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': test_job.guid}

    with ArtifactsModel(test_job.repository.name) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

    for i, failure_line in enumerate(job_failure_lines):

        assert failure_line.best_is_verified is False

        body = {"best_classification": None if i == 0 else classified_failures[0].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body, format="json")

        assert resp.status_code == 200

        failure_line.refresh_from_db()

        if i == 0:
            assert failure_line.best_classification is None
        else:
            assert failure_line.best_classification == classified_failures[0]
        assert failure_line.best_is_verified

    assert test_job.is_fully_verified()

    # will assert if we don't have exactly one note for this job, which is
    # what we want
    note = JobNote.objects.get(job=test_job)

    assert note.failure_classification.id == 4
    assert note.user == test_user
