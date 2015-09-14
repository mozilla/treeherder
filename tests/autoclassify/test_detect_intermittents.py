from django.core.management import call_command

from treeherder.model.models import Matcher, Repository, ClassifiedFailure
from treeherder.autoclassify.matchers import PreciseTestMatcher
from treeherder.autoclassify.detectors import TestFailureDetector
from .utils import test_line, create_failure_lines


def test_detect_intermittents(activate_responses, jm, eleven_jobs_stored, initial_data,
                              failure_lines, classified_failures, retriggers):

    repository = Repository.objects.get(name=jm.project)
    original = jm.get_job(2)
    retrigger = retriggers[0]

    test_failure_lines = create_failure_lines(repository,
                                              retrigger["job_guid"],
                                              [(test_line, {"subtest": "subtest2"}),
                                               (test_line, {"status": "TIMEOUT"}),
                                               (test_line, {"expected": "ERROR"}),
                                               (test_line, {"message": "message2"})])

    old_failure_ids = set(item.id for item in ClassifiedFailure.objects.all())

    # Poke some internal state so that we only use a single matcher for the test
    Matcher._matcher_funcs = {}
    Matcher.objects.register_matcher(PreciseTestMatcher)

    Matcher._detector_funcs = {}
    detector = Matcher.objects.register_detector(TestFailureDetector)

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
        assert match.is_best
        matches_seen.add(match)
        failure_ids_seen.add(match.classified_failure.id)

