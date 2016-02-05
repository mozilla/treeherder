import pytest
from django.core.management import call_command

from treeherder.autoclassify.detectors import (ManualDetector,
                                               TestFailureDetector)
from treeherder.autoclassify.matchers import PreciseTestMatcher

from .utils import (create_bug_suggestions,
                    create_failure_lines,
                    log_line,
                    register_detectors,
                    register_matchers,
                    test_line)


def autoclassify(jm, job, test_failure_lines, status="testfailed"):
    jm.execute(
        proc="jobs_test.updates.set_job_result",
        placeholders=[status, job["id"]]
    )

    register_matchers(PreciseTestMatcher)
    call_command('autoclassify', jm.project, job['job_guid'])

    for item in test_failure_lines:
        item.refresh_from_db()


@pytest.mark.skipif(True, reason="Awaiting landing of Bug 1177519")
def test_classify_test_failure(activate_responses, jm, test_project, test_repository,
                               eleven_jobs_stored, failure_lines, classified_failures):
    job = jm.get_job(2)[0]

    test_failure_lines = create_failure_lines(test_repository,
                                              job["job_guid"],
                                              [(test_line, {}),
                                               (test_line, {"subtest": "subtest2"}),
                                               (test_line, {"status": "TIMEOUT"}),
                                               (test_line, {"expected": "ERROR"}),
                                               (test_line, {"message": "message2"})])

    autoclassify(jm, job, test_failure_lines)

    expected_classified = test_failure_lines[:2]
    expected_unclassified = test_failure_lines[2:]

    for actual, expected in zip(expected_classified, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0


def test_no_autoclassify_job_success(activate_responses, jm, test_project, test_repository,
                                     eleven_jobs_stored, failure_lines, classified_failures):
    job = jm.get_job(2)[0]

    test_failure_lines = create_failure_lines(test_repository,
                                              job["job_guid"],
                                              [(test_line, {}),
                                               (test_line, {"subtest": "subtest2"}),
                                               (test_line, {"status": "TIMEOUT"}),
                                               (test_line, {"expected": "ERROR"}),
                                               (test_line, {"message": "message2"})])

    autoclassify(jm, job, test_failure_lines, status="success")

    expected_classified = []
    expected_unclassified = test_failure_lines

    for actual, expected in zip(expected_classified, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0


def test_autoclassify_update_job_classification(activate_responses, jm, test_repository,
                                                test_project, eleven_jobs_stored,
                                                failure_lines, classified_failures,
                                                mock_autoclassify_jobs_true):
    job = jm.get_job(2)[0]

    for item in classified_failures:
        item.bug_number = "1234"
        item.save()

    create_bug_suggestions(job, test_project, {"search": "TEST-UNEXPECTED-FAIL | test1 | message1"})

    test_failure_lines = create_failure_lines(test_repository,
                                              job["job_guid"],
                                              [(test_line, {})])

    autoclassify(jm, job, test_failure_lines)

    notes = jm.get_job_note_list(job["id"])
    assert len(notes) == 1

    # Check that a bug isn't added by the autoclassifier
    bugs = jm.get_bug_job_map_list(0, 100, conditions={"job_id": set([("=", job["id"])])})
    assert len(bugs) == 0


def test_autoclassify_no_update_job_classification(activate_responses, jm, test_repository,
                                                   test_project, eleven_jobs_stored,
                                                   failure_lines, classified_failures):
    job = jm.get_job(2)[0]

    create_bug_suggestions(job, test_project,
                           {"search": "TEST-UNEXPECTED-FAIL | test1 | message1"},
                           {"search": "Some error that isn't in the structured logs"})

    test_failure_lines = create_failure_lines(test_repository,
                                              job["job_guid"],
                                              [(test_line, {})])

    autoclassify(jm, job, test_failure_lines)

    notes = jm.get_job_note_list(job["id"])
    assert len(notes) == 0


def test_autoclassified_after_manual_classification(activate_responses, jm, test_repository,
                                                    test_project, eleven_jobs_stored,
                                                    failure_lines, failure_classifications):
    register_detectors(ManualDetector, TestFailureDetector)

    job = jm.get_job(2)[0]

    create_bug_suggestions(job, test_project, {"search": "TEST-UNEXPECTED-FAIL | test1 | message1"})

    test_failure_lines = create_failure_lines(test_repository,
                                              job["job_guid"],
                                              [(test_line, {})])

    jm.insert_job_note(job["id"], 4, "test", "")

    for item in test_failure_lines:
        item.refresh_from_db()

    assert len(test_failure_lines[0].matches.all()) == 1
    assert test_failure_lines[0].best_classification == test_failure_lines[0].classified_failures.all()[0]
    assert test_failure_lines[0].best_is_verified


def test_autoclassified_no_update_after_manual_classification_1(activate_responses, jm,
                                                                test_repository, test_project,
                                                                eleven_jobs_stored):
    register_detectors(ManualDetector, TestFailureDetector)

    job = jm.get_job(2)[0]

    create_bug_suggestions(job, test_project,
                           {"search": "TEST-UNEXPECTED-FAIL | test1 | message1"})

    # Line type won't be detected by the detectors we have registered
    test_failure_lines = create_failure_lines(test_repository,
                                              job["job_guid"],
                                              [(log_line, {})])

    jm.insert_job_note(job["id"], 4, "test", "")

    for item in test_failure_lines:
        item.refresh_from_db()

    assert len(test_failure_lines[0].matches.all()) == 0


def test_autoclassified_no_update_after_manual_classification_2(activate_responses, jm,
                                                                test_repository, test_project,
                                                                eleven_jobs_stored):
    register_detectors(ManualDetector, TestFailureDetector)

    job = jm.get_job(2)[0]

    # Too many failure lines
    test_failure_lines = create_failure_lines(test_repository,
                                              job["job_guid"],
                                              [(log_line, {}),
                                               (test_line, {"subtest": "subtest2"})])

    create_bug_suggestions(job, test_project, {"search": "TEST-UNEXPECTED-FAIL | test1 | message1"})

    jm.insert_job_note(job["id"], 4, "test", "")

    for item in test_failure_lines:
        item.refresh_from_db()

    assert len(test_failure_lines[0].matches.all()) == 0


def test_classify_skip_ignore(activate_responses, jm, test_project, test_repository,
                              eleven_jobs_stored, failure_lines, classified_failures):
    job = jm.get_job(2)[0]

    failure_lines[1].best_is_verified = True
    failure_lines[1].best_classification = None
    failure_lines[1].save()

    test_failure_lines = create_failure_lines(test_repository,
                                              job["job_guid"],
                                              [(test_line, {}),
                                               (test_line, {"subtest": "subtest2"})])

    autoclassify(jm, job, test_failure_lines)

    expected_classified = test_failure_lines[:1]
    expected_unclassified = test_failure_lines[1:]

    for actual, expected in zip(expected_classified, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0
