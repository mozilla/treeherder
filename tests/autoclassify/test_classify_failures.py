import pytest
from django.core.management import call_command

from treeherder.autoclassify.matchers import PreciseTestMatcher
from treeherder.model.models import (Matcher,
                                     Repository)

from .utils import (create_failure_lines,
                    test_line)


@pytest.mark.skipif(True, reason="Awaiting landing of Bug 1177519")
def test_classify_test_failure(activate_responses, jm, eleven_jobs_stored,
                               failure_lines, classified_failures):

    repository = Repository.objects.get(name=jm.project)
    job = jm.get_job(2)[0]

    test_failure_lines = create_failure_lines(repository,
                                              job["job_guid"],
                                              [(test_line, {}),
                                               (test_line, {"subtest": "subtest2"}),
                                               (test_line, {"status": "TIMEOUT"}),
                                               (test_line, {"expected": "ERROR"}),
                                               (test_line, {"message": "message2"})])

    # Poke some internal state so that we only use a single matcher for the test
    Matcher._matcher_funcs = {}
    Matcher.objects.register_matcher(PreciseTestMatcher)

    call_command('autoclassify', job['job_guid'], jm.project)

    for item in test_failure_lines:
        item.refresh_from_db()

    expected_classified = test_failure_lines[:2]
    expected_unclassified = test_failure_lines[2:]

    for actual, expected in zip(expected_classified, classified_failures):
        assert [item.id for item in actual.classified_failures.all()] == [expected.id]

    for item in expected_unclassified:
        assert item.classified_failures.count() == 0
