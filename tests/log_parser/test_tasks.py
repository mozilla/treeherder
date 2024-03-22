import pytest
from unittest.mock import patch

from tests.test_utils import add_log_response
from treeherder.etl.jobs import store_job_data
from treeherder.etl.push import store_push_data
from treeherder.model.error_summary import get_error_summary, bug_suggestions_line
from treeherder.model.models import Job, TextLogError, Bugscache

from ..sampledata import SampleData


@pytest.fixture
def jobs_with_local_log(activate_responses):
    sample_data = SampleData()
    url = add_log_response(
        "mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122.txt.gz"
    )

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
        "search_term": ["browser_switchTab_inputHistory.js"],
        "path_end": "browser/components/urlbar/tests/browser/browser_switchTab_inputHistory.js",
    },
)
def test_bug_suggestion_line(
    search_mock, failure_classifications, jobs_with_local_log, sample_push, test_repository
):
    """
    A test to reproduce a search issue with PostgreSQL
    https://github.com/mozilla/treeherder/pull/7986
    """
    store_push_data(test_repository, sample_push)
    for job in jobs_with_local_log:
        job["job"]["result"] = "testfailed"
        job["revision"] = sample_push[0]["revision"]
    store_job_data(test_repository, jobs_with_local_log)

    job = Job.objects.get(id=1)

    # Create a bug entry that pass with MySQL and fails with Postgres
    Bugscache.objects.create(
        id=1775819,
        status="2",
        keywords="intermittent-failure,intermittent-testcase",
        summary=(
            "Intermittent browser/components/urlbar/tests/browser/browser_switchTab_inputHistory.js "
            "| single tracking bug"
        ),
        modified="2010-01-01 00:00:00",
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
            "keywords": "intermittent-failure,intermittent-testcase",
            "resolution": "",
            "status": "2",
            "whiteboard": "",
            "summary": (
                "Intermittent "
                "browser/components/urlbar/tests/browser/browser_switchTab_inputHistory.js "
                "| single tracking bug"
            ),
        }
    ]
