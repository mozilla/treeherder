import time

from first import first

from treeherder.autoclassify.matchers import (PreciseTestMatcher,
                                              score_by_classified_fail_id,
                                              score_matches,
                                              time_boxed)
from treeherder.model.models import (FailureLine,
                                     TextLogErrorMatch,
                                     TextLogErrorMetadata)

from .utils import (create_failure_lines,
                    create_text_log_errors)


def test_precise_test_matcher_with_matches(classified_failures):
    tle = TextLogErrorMatch.objects.first().text_log_error

    classified_failure_id, score = PreciseTestMatcher(None).query_best(tle)

    match = tle.matches.first()
    assert classified_failure_id == match.classified_failure_id
    assert score == match.score


def test_precise_test_matcher_without_matches(test_job, test_matcher):
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

    output = PreciseTestMatcher(None).query_best(tle2)
    assert output is None  # we should have no matches


def test_score_by_classified_fail_id(classified_failures):
    matches = [(m, m.score) for m in TextLogErrorMatch.objects.all()]

    first_match = TextLogErrorMatch.objects.first()

    classified_failure_id, score = score_by_classified_fail_id(matches)

    assert score == first_match.score
    assert classified_failure_id == first_match.classified_failure_id


def test_score_by_classified_fail_id_empty_input():
    output = score_by_classified_fail_id(None)
    assert output is None


def test_score_matches_empty_return():
    output = list(score_matches(matches=None))
    assert output == []

    output = list(score_matches(matches=FailureLine.objects.none()))
    assert output == []


def test_score_matches(classified_failures):
    matches = TextLogErrorMatch.objects.all()
    output = list(score_matches(matches))
    assert len(output) == 1  # both matches have score of 1.0

    TextLogErrorMatch.objects.update(score=0.8)

    matches = TextLogErrorMatch.objects.all()
    output = list(score_matches(matches))
    assert len(output) == 1  # neither match above threshold, but first returned


def test_score_matches_with_manipulated_score(classified_failures):
    matches = TextLogErrorMatch.objects.all()

    output = list(score_matches(matches, score_multiplier=(8, 10)))
    assert len(output) == 1
    score = float(output[0][1])
    assert score == 0.8


def test_time_boxed_enough_budget():
    an_iterable = range(3)

    def quick_sleep(x):
        time.sleep(.1)
        return x

    items = list(time_boxed(quick_sleep, an_iterable, time_budget=5000))

    assert len(items) == 3


def test_time_boxed_cutoff():
    an_iterable = range(3)

    def quick_sleep(x):
        time.sleep(1)
        return x

    items = list(time_boxed(quick_sleep, an_iterable, time_budget=2000))

    assert len(items) < 3
