# -*- coding: utf-8 -*-
from __future__ import division

import time


def score_matches(matches, score_multiplier=(1, 1)):
    """
    Get scores for the given matches.

    Given a QuerySet of TextLogErrorMatches produce a score for each one until
    Good Enough™.  An optional score multiplier can be passed in.
    """
    for match in matches:
        # generate a new score from the current match
        dividend, divisor = score_multiplier
        score = match.score * dividend / divisor

        yield (score, match.classified_failure_id)


def time_boxed(func, iterable, time_budget, *args):
    """
    Apply a function to the items of an iterable within a given time budget.

    Loop the given iterable, calling the given function on each item. The expended
    time is compared to the given time budget after each iteration.
    """
    time_budget = time_budget / 1000  # budget in milliseconds
    start = time.time()

    for thing in iterable:
        yield func(thing, *args)

        end = time.time() - start
        if end > time_budget:
            # Putting the condition at the end of the loop ensures that we
            # always run it once, which is useful for testing
            return
