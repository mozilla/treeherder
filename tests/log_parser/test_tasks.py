from unittest.mock import patch

import pytest

from tests.test_utils import add_log_response
from treeherder.etl.jobs import store_job_data
from treeherder.etl.push import store_push_data
from treeherder.model.error_summary import bug_suggestions_line, get_error_summary
from treeherder.model.models import Bugscache, Job, TextLogError

from ..sampledata import SampleData


@pytest.fixture
def jobs_with_local_log(activate_responses):
    sample_data = SampleData()
    url = add_log_response("crashtest-timeout.log.gz")

    job = sample_data.job_data[0]

    # substitute the log url with a local url
    job["job"]["log_references"][0]["url"] = url
    return [job]


def test_create_error_summary(
    failure_classifications, jobs_with_local_log, sample_push, test_repository
):
    """
    check that a bug suggestions artifact gets inserted when running
    a parse_log task for a failed job, and that the number of
    bug search terms/suggestions matches the number of error lines.
    """
    store_push_data(test_repository, sample_push)

    jobs = jobs_with_local_log
    for job in jobs:
        job["job"]["result"] = "testfailed"
        job["revision"] = sample_push[0]["revision"]

    store_job_data(test_repository, jobs)

    bug_suggestions = get_error_summary(Job.objects.get(id=1))

    # we must have one bugs item per error in bug_suggestions.
    # errors with no bug suggestions will just have an empty
    # bugs list
    assert TextLogError.objects.count() == len(bug_suggestions)

    # We really need to add some tests that check the values of each entry
    # in bug_suggestions, but for now this is better than nothing.
    expected_keys = set(
        [
            "search",
            "path_end",
            "search_terms",
            "bugs",
            "line_number",
            "counter",
            "failure_new_in_rev",
        ]
    )
    for failure_line in bug_suggestions:
        assert set(failure_line.keys()) == expected_keys


@pytest.mark.django_db
@patch(
    "treeherder.model.error_summary.get_error_search_term_and_path",
    return_value={
        "search_term": ["browser_dbg-pretty-print-inline-scripts.js"],
        "path_end": "devtools/client/debugger/test/mochitest/browser_dbg-pretty-print-inline-scripts.js",
    },
)
def test_bug_suggestion_line(
    search_mock, failure_classifications, jobs_with_local_log, sample_push, test_repository
):
    """
    A test to verify similarity of search term (often test name) derived from
    the failure line and bug summary gets taken into account. If it is equal
    for every bug, the expected result won't be returned by the query because
    of its higher bug ID.
    """
    store_push_data(test_repository, sample_push)
    for job in jobs_with_local_log:
        job["job"]["result"] = "testfailed"
        job["revision"] = sample_push[0]["revision"]
    store_job_data(test_repository, jobs_with_local_log)

    job = Job.objects.get(id=1)

    Bugscache.objects.create(
        bugzilla_id=1775819,
        status="2",
        keywords="intermittent-failure,regression,test-verify-fail",
        whiteboard="[retriggered][stockwell unknown]",
        summary=(
            "Intermittent devtools/client/debugger/test/mochitest/browser_dbg-pretty-print-inline-scripts.js "
            "| single tracking bug"
        ),
        modified="2010-01-01 00:00:00",
    )

    # Create 50 other results with an inferior ID.
    # The bug suggestions SQL query fetches up to 50 rows, ordered by match rank then ID.
    # In case results are returned with a wrong rank (e.g. 0 for each result), above related suggestion will be lost.
    Bugscache.objects.bulk_create(
        [
            Bugscache(
                bugzilla_id=100 + i,
                status="2",
                keywords="intermittent-failure,intermittent-testcase",
                summary=(
                    f"Intermittent devtools/client/debugger/test/mochitest/browser_unrelated-{i}.js "
                    "| single tracking bug"
                ),
                modified="2010-01-01 00:00:00",
            )
            for i in range(50)
        ]
    )

    error = job.text_log_error.first()
    summary, line_cache = bug_suggestions_line(
        error,
        project=job.repository,
        logdate=job.submit_time,
        term_cache={},
        line_cache={str(job.submit_time.date()): {}},
        revision=job.push.revision,
    )
    assert summary["bugs"]["open_recent"] == [
        {
            "crash_signature": "",
            "dupe_of": None,
            "id": 1775819,
            "internal_id": 1,
            # Only count occurrences for internal issues
            "occurrences": None,
            "keywords": "intermittent-failure,regression,test-verify-fail",
            "resolution": "",
            "status": "2",
            "whiteboard": "[retriggered][stockwell unknown]",
            "summary": (
                "Intermittent "
                "devtools/client/debugger/test/mochitest/browser_dbg-pretty-print-inline-scripts.js "
                "| single tracking bug"
            ),
        }
    ]


@pytest.mark.django_db
def test_bug_suggestion_line_no_stb(
    failure_classifications, jobs_with_local_log, sample_push, test_repository
):
    """
    A test to verify similarity of search term (often test name) derived from
    the failure line and bug summary gets taken into account. If it is equal
    for every bug, the expected result won't be returned by the query because
    of its higher bug ID.
    """
    store_push_data(test_repository, sample_push)
    for job in jobs_with_local_log:
        job["job"]["result"] = "testfailed"
        job["revision"] = sample_push[0]["revision"]
    store_job_data(test_repository, jobs_with_local_log)

    job = Job.objects.get(id=1)

    Bugscache.objects.create(
        bugzilla_id=1775819,
        status="2",
        keywords="intermittent-failure,regression,test-verify-fail",
        whiteboard="[retriggered][stockwell unknown]",
        summary=(
            "Intermittent browser/components/extensions/test/browser/browser_ext_contextMenus_targetUrlPatterns.js | Test timed out"
        ),
        modified="2010-01-01 00:00:00",
    )

    # Create 50 other results with an inferior ID.
    # The bug suggestions SQL query fetches up to 50 rows, ordered by match rank then ID.
    # In case results are returned with a wrong rank (e.g. 0 for each result), above related suggestion will be lost.
    Bugscache.objects.bulk_create(
        [
            Bugscache(
                bugzilla_id=100 + i,
                status="2",
                keywords="intermittent-failure,intermittent-testcase",
                summary=(
                    f"Intermittent browser/components/extensions/test/browser/browser_unrelated-{i}.js "
                    "| single tracking bug"
                ),
                modified="2010-01-01 00:00:00",
            )
            for i in range(50)
        ]
    )

    error = job.text_log_error.first()
    error.line = "TEST-UNEXPECTED-FAIL | browser/components/extensions/test/browser/browser_ext_contextMenus_targetUrlPatterns.js | Test timed out"
    summary, line_cache = bug_suggestions_line(
        error,
        project=job.repository,
        logdate=job.submit_time,
        term_cache={},
        line_cache={str(job.submit_time.date()): {}},
        revision=job.push.revision,
    )
    assert summary["bugs"]["open_recent"] == [
        {
            "crash_signature": "",
            "dupe_of": None,
            "id": 1775819,
            "internal_id": 1,
            # Only count occurrences for internal issues
            "occurrences": None,
            "keywords": "intermittent-failure,regression,test-verify-fail",
            "resolution": "",
            "status": "2",
            "whiteboard": "[retriggered][stockwell unknown]",
            "summary": (
                "Intermittent "
                "browser/components/extensions/test/browser/browser_ext_contextMenus_targetUrlPatterns.js "
                "| Test timed out"
            ),
        }
    ]
