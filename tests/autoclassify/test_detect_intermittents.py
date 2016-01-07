import pytest
from django.core.management import call_command

from treeherder.autoclassify.detectors import TestFailureDetector
from treeherder.autoclassify.matchers import PreciseTestMatcher
from treeherder.model.models import (ClassifiedFailure,
                                     MatcherManager,
                                     Repository)

from .utils import (create_failure_lines,
                    test_line)


@pytest.mark.skipif(True, reason="Awaiting landing of Bug 1177519")
def test_detect_intermittents(activate_responses, jm, eleven_jobs_stored,
                              failure_lines, classified_failures, retriggers):

    repository = Repository.objects.get(name=jm.project)
    retrigger = retriggers[0]

    test_failure_lines = create_failure_lines(repository,
                                              retrigger["job_guid"],
                                              [(test_line, {"subtest": "subtest2"}),
                                               (test_line, {"status": "TIMEOUT"}),
                                               (test_line, {"expected": "ERROR"}),
                                               (test_line, {"message": "message2"})])

    old_failure_ids = set(item.id for item in ClassifiedFailure.objects.all())

    # Poke some internal state so that we only use a single matcher for the test
    MatcherManager._matcher_funcs = {}
    MatcherManager.register_matcher(PreciseTestMatcher)

    MatcherManager._detector_funcs = {}
    detector = MatcherManager.register_detector(TestFailureDetector)

    call_command('detect_intermittents', retrigger['job_guid'], jm.project)

    assert ClassifiedFailure.objects.count() == len(old_failure_ids) + 4

    matches_seen = set()
    failure_ids_seen = old_failure_ids

    for item in test_failure_lines:
        item.refresh_from_db()
        failure_matches = item.matches.all()
        assert len(failure_matches) == 1
        match = failure_matches[0]
        assert match.classified_failure.id not in failure_ids_seen
        assert match not in matches_seen
        assert match.matcher == detector.db_object
        assert match.score == 1
        assert item.best_classification == match.classified_failure
        assert item.best_is_verified is False
        matches_seen.add(match)
        failure_ids_seen.add(match.classified_failure.id)
