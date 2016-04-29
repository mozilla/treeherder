from decimal import Decimal

from treeherder.model.models import FailureMatch


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
    duplicate_match = FailureMatch(
        failure_line=failure_lines[0],
        classified_failure=classified_failures[1],
        matcher=test_matcher.db_object,
        score=0.8)
    duplicate_match.save()
    rv = classified_failures[1].set_bug(1234)
    assert rv == classified_failures[0]
    assert rv.bug_number == 1234
    for item in failure_lines:
        item.refresh_from_db()
    match.refresh_from_db()
    assert failure_lines[1].best_classification == classified_failures[0]
    matches = failure_lines[0].matches.all()
    assert len(matches) == 1
    assert matches[0].score == Decimal("0.8")
