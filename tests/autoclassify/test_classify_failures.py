from treeherder.autoclassify.autoclassify import match_errors
from treeherder.autoclassify.matchers import crash_signature_matcher, precise_matcher
from treeherder.model.models import (
    BugJobMap,
    ClassifiedFailure,
    JobNote,
    TextLogError,
    TextLogErrorMatch,
)

from .utils import crash_line, create_lines, log_line, test_line


def do_autoclassify(job, test_failure_lines, matchers, status="testfailed"):

    job.result = status
    job.save()

    match_errors(job, matchers)

    for item in test_failure_lines:
        item.refresh_from_db()


def test_classify_test_failure(text_log_errors_failure_lines, classified_failures, test_job_2):
    # Ensure that running autoclassify on a new job classifies lines that
    # exactly match previous classifications

    # The first two lines match classified failures created in teh fixtures
    lines = [
        (test_line, {}),
        (test_line, {"subtest": "subtest2"}),
        (test_line, {"status": "TIMEOUT"}),
        (test_line, {"expected": "ERROR"}),
        (test_line, {"message": "message2"}),
    ]
    test_error_lines, test_failure_lines = create_lines(test_job_2, lines)

    do_autoclassify(test_job_2, test_failure_lines, [precise_matcher])

    expected_classified = test_error_lines[:2], test_failure_lines[:2]
    expected_unclassified = test_error_lines[2:], test_failure_lines[2:]

    for (error_line, failure_line), expected in zip(zip(*expected_classified), classified_failures):
        assert list(error_line.classified_failures.values_list('id', flat=True)) == [expected.id]
        assert list(failure_line.error.classified_failures.values_list('id', flat=True)) == [
            expected.id
        ]

    for error_line, failure_line in zip(*expected_unclassified):
        assert error_line.classified_failures.count() == 0
        assert failure_line.error.classified_failures.count() == 0


def test_no_autoclassify_job_success(
    text_log_errors_failure_lines, classified_failures, test_job_2
):
    # Ensure autoclassification doesn't occur for successful jobs
    lines = [
        (test_line, {}),
        (test_line, {"subtest": "subtest2"}),
        (test_line, {"status": "TIMEOUT"}),
        (test_line, {"expected": "ERROR"}),
        (test_line, {"message": "message2"}),
    ]
    test_error_lines, test_failure_lines = create_lines(test_job_2, lines)

    do_autoclassify(test_job_2, test_failure_lines, [precise_matcher], status="success")

    expected_classified = [], []
    expected_unclassified = test_error_lines, test_failure_lines

    for (error_line, failure_line), expected in zip(zip(*expected_classified), classified_failures):
        assert list(error_line.classified_failures.values_list('id', flat=True)) == [expected.id]
        assert list(failure_line.error.classified_failures.values_list('id', flat=True)) == [
            expected.id
        ]

    for error_line, failure_line in zip(*expected_unclassified):
        assert error_line.classified_failures.count() == 0
        assert failure_line.error.classified_failures.count() == 0


def test_autoclassify_update_job_classification(failure_lines, classified_failures, test_job_2):
    for i, item in enumerate(classified_failures):
        item.bug_number = "1234%i" % i
        item.save()

    lines = [(test_line, {})]
    _, test_failure_lines = create_lines(test_job_2, lines)

    do_autoclassify(test_job_2, test_failure_lines, [precise_matcher])

    assert JobNote.objects.filter(job=test_job_2).count() == 1

    # Check that a bug isn't added by the autoclassifier
    assert BugJobMap.objects.filter(job=test_job_2).count() == 0


def test_autoclassify_no_update_job_classification(
    test_job, test_job_2, text_log_errors_failure_lines, classified_failures
):

    lines = [(test_line, {})]
    test_error_lines, test_failure_lines = create_lines(test_job_2, lines)
    TextLogError.objects.create(
        step=test_error_lines[0].step,
        line="Some error that isn't in the structured logs",
        line_number=2,
    )

    do_autoclassify(test_job_2, test_failure_lines, [precise_matcher])

    assert JobNote.objects.filter(job=test_job_2).count() == 0


def test_autoclassified_after_manual_classification(
    test_user, test_job_2, text_log_errors_failure_lines, failure_classifications, bugs
):
    lines = [(test_line, {})]
    test_error_lines, test_failure_lines = create_lines(test_job_2, lines)
    bug = bugs.first()

    BugJobMap.create(job_id=test_job_2.id, bug_id=bug.id, user=test_user)
    JobNote.objects.create(job=test_job_2, failure_classification_id=4, user=test_user, text="")

    for error_line, failure_line in zip(test_error_lines, test_failure_lines):
        error_line.refresh_from_db()
        error_line.metadata.refresh_from_db()
        failure_line.refresh_from_db()

    tle1 = test_error_lines[0]
    fl1 = test_failure_lines[0]

    assert tle1.matches.count() == 1
    assert tle1.metadata.best_classification == tle1.classified_failures.first()
    assert tle1.metadata.best_is_verified

    assert fl1.error.matches.count() == 1
    assert fl1.error.metadata.best_classification == fl1.error.classified_failures.first()
    assert fl1.text_log_error_metadata.best_is_verified


def test_autoclassified_no_update_after_manual_classification_1(
    test_job_2, test_user, failure_classifications
):
    # Line type won't be detected by the matchers we have registered
    lines = [(log_line, {})]
    test_error_lines, test_failure_lines = create_lines(test_job_2, lines)

    JobNote.objects.create(job=test_job_2, failure_classification_id=4, user=test_user, text="")

    for error_line, failure_line in zip(test_error_lines, test_failure_lines):
        error_line.refresh_from_db()
        failure_line.refresh_from_db()

    assert not test_error_lines[0].matches.all().exists()
    assert not test_failure_lines[0].error.matches.all().exists()


def test_autoclassified_no_update_after_manual_classification_2(
    test_user, test_job_2, failure_classifications
):
    # Too many failure lines
    _, test_failure_lines = create_lines(
        test_job_2, [(log_line, {}), (test_line, {"subtest": "subtest2"})]
    )

    JobNote.objects.create(job=test_job_2, failure_classification_id=4, user=test_user, text="")

    for item in test_failure_lines:
        item.refresh_from_db()

    assert not test_failure_lines[0].error.matches.all().exists()


def test_classify_skip_ignore(test_job_2, text_log_errors_failure_lines, classified_failures):

    text_log_errors, failure_lines = text_log_errors_failure_lines
    text_log_errors[1].metadata.best_is_verified = True
    text_log_errors[1].metadata.best_classification = None
    text_log_errors[1].metadata.save()

    _, test_failure_lines = create_lines(
        test_job_2, [(test_line, {}), (test_line, {"subtest": "subtest2"})]
    )

    do_autoclassify(test_job_2, test_failure_lines, [precise_matcher])

    expected_classified = test_failure_lines[:1]
    expected_unclassified = test_failure_lines[1:]

    for actual, expected in zip(expected_classified, classified_failures):
        assert [item.id for item in actual.error.classified_failures.all()] == [expected.id]

    for item in expected_unclassified:
        assert item.error.classified_failures.count() == 0


def test_classify_multiple(test_job_2, failure_lines, classified_failures):
    _, test_failure_lines = create_lines(
        test_job_2, [(test_line, {}), (test_line, {"message": "message 1.2"})]
    )

    expected_classified_precise = [test_failure_lines[0]]

    do_autoclassify(test_job_2, test_failure_lines, [precise_matcher])

    for actual, expected in zip(expected_classified_precise, classified_failures):
        assert list(actual.error.classified_failures.values_list('id', flat=True)) == [expected.id]
        assert actual.error.matches.first().matcher_name == "precise_matcher"


def test_classify_crash(test_repository, test_job, test_job_2, test_matcher):
    error_lines_ref, failure_lines_ref = create_lines(test_job, [(crash_line, {})])

    _, failure_lines = create_lines(
        test_job_2,
        [
            (crash_line, {}),
            (crash_line, {"test": "test1"}),
            (crash_line, {"signature": "signature1"}),
            (crash_line, {"signature": None}),
        ],
    )

    classified_failure = ClassifiedFailure.objects.create()
    TextLogErrorMatch.objects.create(
        text_log_error=error_lines_ref[0],
        classified_failure=classified_failure,
        matcher_name=test_matcher.__class__.__name__,
        score=1.0,
    )
    do_autoclassify(test_job_2, failure_lines, [crash_signature_matcher])

    expected_classified = failure_lines[0:2]
    expected_unclassified = failure_lines[2:]

    for actual in expected_classified:
        assert list(actual.error.classified_failures.values_list('id', flat=True)) == [
            classified_failure.id
        ]

    for item in expected_unclassified:
        assert item.error.classified_failures.count() == 0
