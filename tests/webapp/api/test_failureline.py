import json

from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from tests.autoclassify.utils import (create_failure_lines,
                                      test_line)
from treeherder.autoclassify.detectors import ManualDetector
from treeherder.model.derived import ArtifactsModel
from treeherder.model.models import (FailureLine,
                                     Matcher,
                                     MatcherManager)
from treeherder.model.search import TestFailureLine


def test_get_failure_line(webapp, eleven_jobs_stored, jm, failure_lines):
    """
    test getting a single failure line
    """
    resp = webapp.get(
        reverse("failure-line-detail", kwargs={"pk": failure_lines[0].id}))

    assert resp.status_int == 200

    failure_line = resp.json

    assert isinstance(failure_line, object)
    exp_failure_keys = ["id", "job_guid", "repository", "action", "line",
                        "test", "subtest", "status", "expected", "message",
                        "signature", "level", "created", "modified", "matches",
                        "best_classification", "best_is_verified", "classified_failures",
                        "unstructured_bugs"]

    assert set(failure_line.keys()) == set(exp_failure_keys)


def test_update_failure_line_verify(eleven_jobs_stored, jm, failure_lines,
                                    classified_failures, test_user):

    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": jm.project,
            "best_classification": classified_failures[0].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified

    TestFailureLine._doc_type.refresh()
    es_line = TestFailureLine.get(failure_line.id)
    assert es_line.best_classification == classified_failures[0].id
    assert es_line.best_is_verified


def test_update_failure_line_replace(eleven_jobs_stored, jm, failure_lines,
                                     classified_failures, test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": jm.project,
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


def test_update_failure_line_mark_job(eleven_jobs_stored,
                                      mock_autoclassify_jobs_true, jm,
                                      failure_lines,
                                      classified_failures, test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job = jm.get_job(1)[0]

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == job["job_guid"]]

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': job['job_guid']}

    with ArtifactsModel(jm.project) as artifacts_model:
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

    assert jm.is_fully_verified(job['id'])

    notes = jm.get_job_note_list(job['id'])

    assert len(notes) == 1

    assert notes[0]["failure_classification_id"] == 4
    assert notes[0]["who"] == test_user.email


def test_update_failure_line_mark_job_with_human_note(eleven_jobs_stored,
                                                      mock_autoclassify_jobs_true, jm,
                                                      failure_lines,
                                                      classified_failures, test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job = jm.get_job(1)[0]

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == job["job_guid"]]

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': job['job_guid']}

    with ArtifactsModel(jm.project) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

    jm.insert_job_note(job["id"], 4, test_user.email, "note")

    for failure_line in job_failure_lines:

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body, format="json")

        assert resp.status_code == 200

    assert jm.is_fully_verified(job['id'])

    notes = jm.get_job_note_list(job['id'])

    assert len(notes) == 1

    assert notes[0]["failure_classification_id"] == 4
    assert notes[0]["who"] == test_user.email


def test_update_failure_line_mark_job_with_auto_note(eleven_jobs_stored,
                                                     mock_autoclassify_jobs_true, jm,
                                                     failure_lines,
                                                     classified_failures, test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job = jm.get_job(1)[0]

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == job["job_guid"]]

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': job['job_guid']}

    with ArtifactsModel(jm.project) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

    jm.insert_job_note(job["id"], 7, "autoclassifier", "note", autoclassify=True)

    for failure_line in job_failure_lines:

        body = {"best_classification": classified_failures[1].id}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body, format="json")

        assert resp.status_code == 200

    assert jm.is_fully_verified(job['id'])

    notes = jm.get_job_note_list(job['id'])

    assert len(notes) == 2

    assert notes[0]["failure_classification_id"] == 4
    assert notes[0]["who"] == test_user.email


def test_update_failure_lines(eleven_jobs_stored,
                              mock_autoclassify_jobs_true, jm,
                              test_repository, failure_lines,
                              classified_failures, test_user):

    jobs = (jm.get_job(1)[0], jm.get_job(2)[0])
    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    create_failure_lines(test_repository,
                         jobs[1]["job_guid"],
                         [(test_line, {}),
                          (test_line, {"subtest": "subtest2"})])

    failure_lines = FailureLine.objects.filter(
        job_guid__in=[job["job_guid"] for job in jobs]).all()

    for job in jobs:
        job_failure_lines = FailureLine.objects.filter(job_guid=job["job_guid"]).all()
        bs_artifact = {'type': 'json',
                       'name': 'Bug suggestions',
                       'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                            (line.status.upper(), line.message)} for line in
                                           job_failure_lines]),
                       'job_guid': job['job_guid']}

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
        assert jm.is_fully_verified(job['id'])

        notes = jm.get_job_note_list(job['id'])

        assert len(notes) == 1

        assert notes[0]["failure_classification_id"] == 4
        assert notes[0]["who"] == test_user.email


def test_update_failure_line_ignore(eleven_jobs_stored, jm, failure_lines,
                                    classified_failures, test_user):

    client = APIClient()
    client.force_authenticate(user=test_user)

    MatcherManager.register_detector(ManualDetector)

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": jm.project,
            "best_classification": None}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification is None
    assert failure_line.best_is_verified


def test_update_failure_line_all_ignore_mark_job(eleven_jobs_stored,
                                                 mock_autoclassify_jobs_true, jm,
                                                 failure_lines,
                                                 classified_failures,
                                                 test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job = jm.get_job(1)[0]

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == job["job_guid"]]

    for failure_line in job_failure_lines:
        failure_line.best_is_verified = False
        failure_line.best_classification = None

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': job['job_guid']}

    with ArtifactsModel(jm.project) as artifacts_model:
        artifacts_model.load_job_artifacts([bs_artifact])

    assert len(jm.get_job_note_list(job['id'])) == 0

    for failure_line in job_failure_lines:

        assert failure_line.best_is_verified is False

        body = {"best_classification": None}

        resp = client.put(reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
                          body, format="json")

        assert resp.status_code == 200

        failure_line.refresh_from_db()

        assert failure_line.best_classification is None
        assert failure_line.best_is_verified

    assert jm.is_fully_verified(job['id'])

    notes = jm.get_job_note_list(job['id'])

    assert len(notes) == 1


def test_update_failure_line_partial_ignore_mark_job(eleven_jobs_stored,
                                                     mock_autoclassify_jobs_true, jm,
                                                     failure_lines,
                                                     classified_failures,
                                                     test_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    client.force_authenticate(user=test_user)

    job = jm.get_job(1)[0]

    job_failure_lines = [line for line in failure_lines if
                         line.job_guid == job["job_guid"]]

    bs_artifact = {'type': 'json',
                   'name': 'Bug suggestions',
                   'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" %
                                        (line.status.upper(), line.message)}
                                       for line in job_failure_lines]),
                   'job_guid': job['job_guid']}

    with ArtifactsModel(jm.project) as artifacts_model:
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

    assert jm.is_fully_verified(job['id'])

    notes = jm.get_job_note_list(job['id'])

    assert len(notes) == 1
    assert notes[0]["failure_classification_id"] == 4
    assert notes[0]["who"] == test_user.email
