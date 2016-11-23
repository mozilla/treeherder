from datetime import (datetime,
                      timedelta)

from treeherder.autoclassify.detectors import (ManualDetector,
                                               TestFailureDetector)
from treeherder.autoclassify.matchers import (CrashSignatureMatcher,
                                              ElasticSearchTestMatcher,
                                              PreciseTestMatcher,
                                              time_window)
from treeherder.autoclassify.tasks import autoclassify
from treeherder.model.models import (BugJobMap,
                                     ClassifiedFailure,
                                     FailureMatch,
                                     JobNote,
                                     TextLogError,
                                     TextLogStep)

from .utils import (crash_line,
                    create_failure_lines,
                    create_text_log_errors,
                    log_line,
                    register_detectors,
                    register_matchers,
                    test_line)


def do_autoclassify(jm, job, test_failure_lines, matchers, status="testfailed"):

    jm.execute(
        proc="jobs_test.updates.set_job_result",
        placeholders=[status, job.project_specific_id]
    )

    register_matchers(*matchers)

    autoclassify(job.id)

    for item in test_failure_lines:
        item.refresh_from_db()


def test_classify_test_failure(jm, failure_lines, classified_failures,
                               test_job_2):
    test_failure_lines = create_failure_lines(test_job_2,
                                              [(test_line, {}),
                                               (test_line, {"subtest": "subtest2"}),
                                               (test_line, {"status": "TIMEOUT"}),
                                               (test_line, {"expected": "ERROR"}),
                                               (test_line, {"message": "message2"})])

    do_autoclassify(jm, test_job_2, test_failure_lines, [PreciseTestMatcher])

    expected_classified = test_failure_lines[:2]
    expected_unclassified = test_failure_lines[2:]

    for actual, expected in zip(expected_classified, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0


def test_no_autoclassify_job_success(jm, failure_lines, classified_failures, test_job_2):
    test_failure_lines = create_failure_lines(test_job_2,
                                              [(test_line, {}),
                                               (test_line, {"subtest": "subtest2"}),
                                               (test_line, {"status": "TIMEOUT"}),
                                               (test_line, {"expected": "ERROR"}),
                                               (test_line, {"message": "message2"})])

    do_autoclassify(jm, test_job_2, test_failure_lines, [PreciseTestMatcher], status="success")

    expected_classified = []
    expected_unclassified = test_failure_lines

    for actual, expected in zip(expected_classified, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0


def test_autoclassify_update_job_classification(jm, failure_lines, classified_failures,
                                                test_job_2, mock_autoclassify_jobs_true):
    for i, item in enumerate(classified_failures):
        item.bug_number = "1234%i" % i
        item.save()

    test_failure_lines = create_failure_lines(test_job_2,
                                              [(test_line, {})])

    create_text_log_errors(test_job_2, [(test_line, {})])
    do_autoclassify(jm, test_job_2, test_failure_lines, [PreciseTestMatcher])

    assert JobNote.objects.filter(job=test_job_2).count() == 1

    # Check that a bug isn't added by the autoclassifier
    assert BugJobMap.objects.filter(job=test_job_2).count() == 0


def test_autoclassify_no_update_job_classification(jm, test_job, test_job_2,
                                                   failure_lines,
                                                   classified_failures):

    test_failure_lines = create_failure_lines(test_job, [(test_line, {})])
    step = TextLogStep.objects.create(job=test_job_2,
                                      name='unnamed step',
                                      started_line_number=1,
                                      finished_line_number=10,
                                      result=TextLogStep.TEST_FAILED)
    TextLogError.objects.create(step=step,
                                line='TEST-UNEXPECTED-FAIL | test1 | message1',
                                line_number=1)
    TextLogError.objects.create(step=step,
                                line="Some error that isn't in the structured logs",
                                line_number=2)
    test_failure_lines = create_failure_lines(test_job_2,
                                              [(test_line, {})])

    do_autoclassify(jm, test_job_2, test_failure_lines, [PreciseTestMatcher])

    assert JobNote.objects.filter(job=test_job_2).count() == 0


def test_autoclassified_after_manual_classification(jm, test_user, test_job_2,
                                                    failure_lines, failure_classifications):
    register_detectors(ManualDetector, TestFailureDetector)

    create_text_log_errors(test_job_2, [(test_line, {})])
    test_failure_lines = create_failure_lines(test_job_2, [(test_line, {})])

    JobNote.objects.create(job=test_job_2,
                           failure_classification_id=4,
                           user=test_user,
                           text="")

    for item in test_failure_lines:
        item.refresh_from_db()

    assert len(test_failure_lines[0].matches.all()) == 1
    assert test_failure_lines[0].best_classification == test_failure_lines[0].classified_failures.all()[0]
    assert test_failure_lines[0].best_is_verified


def test_autoclassified_no_update_after_manual_classification_1(jm, test_job_2,
                                                                test_user,
                                                                failure_classifications):
    register_detectors(ManualDetector, TestFailureDetector)

    # Line type won't be detected by the detectors we have registered
    test_failure_lines = create_failure_lines(test_job_2, [(log_line, {})])

    JobNote.objects.create(job=test_job_2,
                           failure_classification_id=4,
                           user=test_user,
                           text="")

    for item in test_failure_lines:
        item.refresh_from_db()

    assert len(test_failure_lines[0].matches.all()) == 0


def test_autoclassified_no_update_after_manual_classification_2(test_user, test_job_2,
                                                                failure_classifications):
    register_detectors(ManualDetector, TestFailureDetector)

    # Too many failure lines
    test_failure_lines = create_failure_lines(test_job_2,
                                              [(log_line, {}),
                                               (test_line, {"subtest": "subtest2"})])

    JobNote.objects.create(job=test_job_2,
                           failure_classification_id=4,
                           user=test_user,
                           text="")

    for item in test_failure_lines:
        item.refresh_from_db()

    assert len(test_failure_lines[0].matches.all()) == 0


def test_classify_skip_ignore(jm, test_job_2, failure_lines,
                              classified_failures):

    failure_lines[1].best_is_verified = True
    failure_lines[1].best_classification = None
    failure_lines[1].save()

    test_failure_lines = create_failure_lines(test_job_2,
                                              [(test_line, {}),
                                               (test_line, {"subtest": "subtest2"})])

    do_autoclassify(jm, test_job_2, test_failure_lines, [PreciseTestMatcher])

    expected_classified = test_failure_lines[:1]
    expected_unclassified = test_failure_lines[1:]

    for actual, expected in zip(expected_classified, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0


def test_classify_es(jm, test_job_2, failure_lines, classified_failures):
    test_failure_lines = create_failure_lines(test_job_2,
                                              [(test_line, {}),
                                               (test_line, {"message": "message2"}),
                                               (test_line, {"message": "message 1.2"}),
                                               (test_line, {"message": "message 0x1F"}),
                                               (test_line, {"subtest": "subtest3"}),
                                               (test_line, {"status": "TIMEOUT"}),
                                               (test_line, {"expected": "ERROR"})])

    do_autoclassify(jm, test_job_2, test_failure_lines, [ElasticSearchTestMatcher])

    expected_classified = test_failure_lines[:4]
    expected_unclassified = test_failure_lines[4:]

    for actual in expected_classified:
        assert [item.id for item in actual.classified_failures.all()] == [classified_failures[0].id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0


def test_classify_multiple(jm, test_job_2, failure_lines, classified_failures):
    test_failure_lines = create_failure_lines(test_job_2,
                                              [(test_line, {}),
                                               (test_line, {"message": "message 1.2"})])

    expected_classified_precise = [test_failure_lines[0]]
    expected_classified_fuzzy = [test_failure_lines[1]]

    do_autoclassify(jm, test_job_2, test_failure_lines, [PreciseTestMatcher,
                                                         ElasticSearchTestMatcher])

    for actual, expected in zip(expected_classified_precise, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]
        assert [item.matcher.id == 1 for item in item.matches.all()]

    for actual, expected in zip(expected_classified_fuzzy, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]
        assert [item.matcher.id == 2 for item in item.matches.all()]


def test_classify_crash(jm, test_project, test_job, test_job_2, test_matcher):
    failure_lines_ref = create_failure_lines(test_job,
                                             [(crash_line, {})])

    failure_lines = create_failure_lines(test_job_2,
                                         [(crash_line, {}),
                                          (crash_line, {"test": "test1"}),
                                          (crash_line, {"signature": "signature1"}),
                                          (crash_line, {"signature": None})])

    classified_failure = ClassifiedFailure.objects.create()
    FailureMatch.objects.create(failure_line=failure_lines_ref[0],
                                classified_failure=classified_failure,
                                matcher=test_matcher.db_object,
                                score=1.0)
    do_autoclassify(jm, test_job_2, failure_lines, [CrashSignatureMatcher])

    expected_classified = failure_lines[0:2]
    expected_unclassified = failure_lines[2:]

    for actual in expected_classified:
        assert [item.id for item in actual.classified_failures.all()] == [classified_failure.id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0


def test_classify_test_failure_window(failure_lines, classified_failures):
    failure_lines[0].created = datetime.now() - timedelta(days=2)
    failure_lines[0].save()

    failure_matches = FailureMatch.objects.all()
    failure_matches[1].score = 0.5
    failure_matches[1].save()

    best_match = time_window(FailureMatch.objects.all(), timedelta(days=1), 0,
                             lambda x: x.score)

    assert best_match == failure_matches[1]

    best_match = time_window(FailureMatch.objects.all(), timedelta(days=1), None,
                             lambda x: x.score)

    assert best_match == failure_matches[1]
