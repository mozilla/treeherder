from decimal import Decimal

from django.contrib.auth.models import User

from tests.autoclassify.utils import create_lines, test_line
from treeherder.autoclassify.autoclassify import mark_best_classification
from treeherder.model.models import (
    BugJobMap,
    ClassifiedFailure,
    FailureLine,
    TextLogErrorMatch,
    TextLogErrorMetadata,
)


def test_set_bug(classified_failures):
    rv = classified_failures[0].set_bug(1234)
    assert rv == classified_failures[0]
    assert classified_failures[0].bug_number == 1234


def test_set_bug_duplicate(text_log_errors_failure_lines, classified_failures, test_matcher):
    _, failure_lines = text_log_errors_failure_lines
    failure_line = failure_lines[0]

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    match = failure_line.error.matches.first()
    match.score = 0.7
    match.save()

    # Add a FailureMatch that will have the same (failure_line_id, classified_failure_id)
    # as another FailureMatch when classified_failure[1] is replaced by classified_failure[0]
    TextLogErrorMatch.objects.create(
        text_log_error=failure_line.error,
        classified_failure=classified_failures[1],
        matcher_name=test_matcher,
        score=0.8,
    )

    assert failure_line.error.matches.count() == 2

    classified_failure = classified_failures[1].set_bug(1234)
    assert classified_failure == classified_failures[0]
    assert classified_failure.bug_number == 1234

    failure_lines = FailureLine.objects.all()
    match.refresh_from_db()

    # Check that we updated the best classification that previously pointed
    # to the now-defunct classified_failures[0]
    assert failure_lines[1].text_log_error_metadata.best_classification == classified_failures[0]

    matches = failure_line.error.matches.all()

    # Check that we only have one match for the first failure line
    assert len(matches) == 1

    # Check we picked the better of the two scores for the new match.
    assert matches[0].score == Decimal("0.8")

    # Ensure we deleted the ClassifiedFailure on which we tried to set the bug
    assert not ClassifiedFailure.objects.filter(id=classified_failures[1].id).exists()


def test_update_autoclassification_bug(test_job, test_job_2, classified_failures):
    classified_failure = classified_failures[0]
    user = User.objects.create()

    # create some TextLogErrors attached to test_job_2
    text_log_errors, _ = create_lines(test_job_2, [(test_line, {})])

    # Job 1 has two failure lines so nothing should be updated
    assert classified_failure.bug_number is None

    # Create a BugJobMap
    BugJobMap.create(
        job_id=test_job.id, bug_id=1234, user=user,
    )
    mark_best_classification(text_log_errors[0], classified_failure)
    assert classified_failure.bug_number is None

    metadata = TextLogErrorMetadata.objects.get(text_log_error__step__job=test_job_2)
    metadata.failure_line = FailureLine.objects.get(pk=3)
    metadata.save()

    BugJobMap.create(
        job_id=test_job_2.id, bug_id=1234, user=user,
    )
    classified_failure.refresh_from_db()
    assert classified_failure.bug_number == 1234
