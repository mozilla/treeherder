from decimal import Decimal

from tests.autoclassify.utils import (create_lines,
                                      test_line)
from treeherder.autoclassify.autoclassify import mark_best_classification
from treeherder.model.models import (Classification,
                                     FailureLine,
                                     TextLogErrorMatch,
                                     TextLogErrorMetadata)


def test_set_bug(classifications):
    rv = classifications[0].set_bug(1234)
    assert rv == classifications[0]
    assert classifications[0].bug_number == 1234


def test_set_bug_duplicate(text_log_errors_failure_lines, classifications, test_matcher):
    _, failure_lines = text_log_errors_failure_lines
    failure_line = failure_lines[0]

    classifications[0].bug_number = 1234
    classifications[0].save()

    match = failure_line.error.matches.first()
    match.score = 0.7
    match.save()

    # Add a FailureMatch that will have the same (failure_line_id, classification_id)
    # as another FailureMatch when classification[1] is replaced by classification[0]
    TextLogErrorMatch.objects.create(
        text_log_error=failure_line.error,
        classification=classifications[1],
        matcher_name=test_matcher,
        score=0.8,
    )

    assert failure_line.error.matches.count() == 2

    classification = classifications[1].set_bug(1234)
    assert classification == classifications[0]
    assert classification.bug_number == 1234

    failure_lines = FailureLine.objects.all()
    match.refresh_from_db()

    # Check that we updated the best classification that previously pointed
    # to the now-defunct classifications[0]
    assert failure_lines[1].text_log_error_metadata.best_classification == classifications[0]

    matches = failure_line.error.matches.all()

    # Check that we only have one match for the first failure line
    assert len(matches) == 1

    # Check we picked the better of the two scores for the new match.
    assert matches[0].score == Decimal("0.8")

    # Ensure we deleted the Classification on which we tried to set the bug
    assert not Classification.objects.filter(id=classifications[1].id).exists()


def test_update_autoclassification_bug(test_job, test_job_2, classifications):
    classification = classifications[0]

    # Job 1 has two failure lines so nothing should be updated
    assert test_job.update_autoclassification_bug(1234) is None

    lines = [(test_line, {})]
    error_lines, _ = create_lines(test_job_2, lines)

    mark_best_classification(error_lines[0], classifications[0])
    assert classification.bug_number is None

    metadata = TextLogErrorMetadata.objects.get(text_log_error__step__job=test_job_2)
    metadata.failure_line = FailureLine.objects.get(pk=3)
    metadata.save()

    assert test_job_2.update_autoclassification_bug(1234) == classifications[0]
    classifications[0].refresh_from_db()
    assert classifications[0].bug_number == 1234
