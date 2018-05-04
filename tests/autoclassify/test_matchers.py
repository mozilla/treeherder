import time

from treeherder.autoclassify.matchers import (score_by_classified_fail_id,
                                              score_matches,
                                              time_boxed)
from treeherder.model.models import (FailureLine,
                                     TextLogErrorMatch)


def test_score_by_classified_fail_id(classified_failures):
    matches = [(m, m.score) for m in TextLogErrorMatch.objects.all()]

    first_match = TextLogErrorMatch.objects.first()

    classified_failure_id, scored_match = score_by_classified_fail_id(matches)
    match, score = scored_match

    assert match == first_match
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
