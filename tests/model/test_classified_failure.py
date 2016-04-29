from decimal import Decimal

from treeherder.model.models import (ClassifiedFailure,
                                     FailureMatch)


def test_set_bug(classified_failures):
    rv = classified_failures[0].set_bug(1234)
    assert rv == classified_failures[0]
    assert classified_failures[0].bug_number == 1234


def test_set_bug_duplicate(failure_lines, classified_failures, test_matcher):
    classified_failures[0].bug_number = 1234
    classified_failures[0].save()
    match = failure_lines[0].matches.all()[0]
    match.score = 0.7
    match.save()
    # Add a FailureMatch that will have the same (failure_line_id, classified_failure_id)
    # as another FailureMatch when classified_failure[1] is replaced by classified_failure[0]
    duplicate_match = FailureMatch(
        failure_line=failure_lines[0],
        classified_failure=classified_failures[1],
        matcher=test_matcher.db_object,
        score=0.8)
    duplicate_match.save()
    assert len(failure_lines[0].matches.all()) == 2
    rv = classified_failures[1].set_bug(1234)
    assert rv == classified_failures[0]
    assert rv.bug_number == 1234
    for item in failure_lines:
        item.refresh_from_db()
    match.refresh_from_db()
    # Check that we updated the best classification that previously pointed
    # to the now-defunct classified_failures[0]
    assert failure_lines[1].best_classification == classified_failures[0]
    # Check that we only have one match for the first failure line
    matches = failure_lines[0].matches.all()
    assert len(matches) == 1
    # Check we picked the better of the two scores for the new match.
    assert matches[0].score == Decimal("0.8")
    # Ensure we deleted the ClassifiedFailure on which we tried to set the bug
    assert len(ClassifiedFailure.objects.filter(id=classified_failures[1].id)) == 0
