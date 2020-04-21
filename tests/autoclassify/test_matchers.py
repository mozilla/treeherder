from decimal import Decimal

from first import first

from treeherder.autoclassify.matchers import precise_matcher
from treeherder.autoclassify.utils import score_matches
from treeherder.model.models import FailureLine, TextLogErrorMatch, TextLogErrorMetadata

from .utils import create_failure_lines, create_text_log_errors


def test_precise_matcher_with_matches(classified_failures):
    tle = TextLogErrorMatch.objects.first().text_log_error

    results = precise_matcher(tle)
    score, classified_failure_id = first(results)

    match = tle.matches.first()
    assert classified_failure_id == match.classified_failure_id
    assert score == match.score


def test_precise_matcher_without_matches(test_job, test_matcher):
    # create an error log group to match against
    data1 = {
        'action': 'test_result',
        'test': 'test1',
        'subtest': 'test1',
        'status': 'FAIL',
        'expected': 'PASS',
        'message': 'lost connection to external service',
    }
    data2 = {
        'action': 'test_result',
        'test': 'test2',
        'subtest': 'test1',
        'status': 'FAIL',
        'expected': 'PASS',
        'message': 'lost connection to external service',
    }

    failure_line1 = first(create_failure_lines(test_job, [(data1, {})]))
    failure_line2 = first(create_failure_lines(test_job, [(data2, {})]))

    tle1, tle2 = create_text_log_errors(test_job, [(data1, {}), (data2, {})])

    TextLogErrorMetadata.objects.create(text_log_error=tle1, failure_line=failure_line1)
    TextLogErrorMetadata.objects.create(text_log_error=tle2, failure_line=failure_line2)

    output = precise_matcher(tle2)
    assert output is None  # we should have no matches


def test_score_matches_empty_return():
    output = list(score_matches(matches=[]))
    assert output == []

    output = list(score_matches(matches=FailureLine.objects.none()))
    assert output == []


def test_scored_matches(classified_failures):
    matches = TextLogErrorMatch.objects.all()
    output = list(score_matches(matches))
    assert len(output) == len(matches)


def test_scored_matches_with_manipulated_score(classified_failures):
    matches = TextLogErrorMatch.objects.all()

    results = list(score_matches(matches, score_multiplier=(8, 10)))
    assert len(results) == len(matches)

    score, _ = first(results)
    assert score == Decimal('0.8')
