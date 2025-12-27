import datetime
import json
import logging
import re
from collections import defaultdict

from django.core.cache import cache
from django.db.models import Q

from treeherder.model.models import (
    FailureLine,
    InvestigatedTests,
    Job,
    JobType,
    OptionCollection,
    TextLogError,
)
from treeherder.push_health.filter import filter_failure
from treeherder.push_health.utils import (
    clean_config,
    clean_platform,
    clean_test,
    job_to_dict,
)

logger = logging.getLogger(__name__)

CACHE_KEY_ROOT = "failure_history"
ONE_WEEK_IN_SECONDS = 604800
intermittent_history_days = 14
fixed_by_commit_history_days = 30
ignored_log_lines = [
    "Return code: 1",
    "exit status 1",
    "unexpected status",
    "Force-terminating active process(es)",
]


def get_history(
    failure_classification_id, push_date, num_days, option_map, repository_ids, force_update=False
):
    start_date = push_date - datetime.timedelta(days=num_days)
    end_date = push_date - datetime.timedelta(days=2)
    cache_key = f"{CACHE_KEY_ROOT}:{failure_classification_id}:{push_date}"
    previous_failures_json = cache.get(cache_key)

    if not previous_failures_json or force_update:
        failure_lines = (
            FailureLine.objects.filter(
                job_log__job__result="testfailed",
                job_log__job__tier__lte=2,
                job_log__job__failure_classification_id=failure_classification_id,
                job_log__job__push__repository_id__in=repository_ids,
                job_log__job__push__time__gt=start_date,
                job_log__job__push__time__lt=end_date,
            )
            .exclude(test=None)
            .select_related("job_log__job__machine_platform", "job_log__job__push")
            .values(
                "action",
                "test",
                "signature",
                "message",
                "job_log__job__machine_platform__platform",
                "job_log__job__option_collection_hash",
            )
            .distinct()
        )
        previous_failures = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        for line in failure_lines:
            previous_failures[clean_test(line["test"], line["signature"], line["message"])][
                clean_platform(line["job_log__job__machine_platform__platform"])
            ][clean_config(option_map[line["job_log__job__option_collection_hash"]])] += 1

        cache.set(cache_key, json.dumps(previous_failures), ONE_WEEK_IN_SECONDS)
    else:
        previous_failures = json.loads(previous_failures_json)

    return previous_failures


# For each failure item in ``tests``, we group all jobs of the exact same type into
# a field called `jobs`.  So it has passed and failed jobs in there.
# Note: get_current_test_failures was inlined into get_test_failures for clarity


def _generate_test_key(test_name, config, platform, job_name, job_group):
    """Generate unique key for test+platform+config+job combination."""
    return re.sub(r"\W+", "", f"t{test_name}{config}{platform}{job_name}{job_group}")


def _check_investigation_status(test_name, job_type_id, investigated_tests):
    """Check if a test is marked as investigated.

    Returns:
        tuple: (is_investigated: bool, investigated_test_id: int or None)
    """
    if not investigated_tests:
        return False, None

    for investigated_test in investigated_tests:
        if investigated_test.test == test_name and job_type_id == investigated_test.job_type.id:
            return True, investigated_test.id

    return False, None


def _count_total_jobs_for_type(job_name, all_jobs_dict):
    """Count total jobs (success + testfailed) for a given job type."""
    return len(
        [
            job
            for job in all_jobs_dict.get(job_name, [])
            if job["result"] in ["success", "testfailed"]
        ]
    )


def _create_test_failure_record(
    test_name,
    failure_line,
    job,
    config,
    platform,
    test_key,
    total_jobs_for_type,
    is_investigated,
    investigated_test_id,
):
    """Create the test failure record dictionary with all required fields."""
    return {
        "testName": test_name,
        "action": failure_line.action.split("_")[0],
        "jobName": job.job_type.name,
        "jobSymbol": job.job_type.symbol,
        "jobGroup": job.job_group.name,
        "jobGroupSymbol": job.job_group.symbol,
        "platform": platform,
        "config": config,
        "key": test_key,
        "jobKey": job.job_key,
        "suggestedClassification": "New Failure",
        "confidence": 0,  # Always 0 - no historical lookup
        "tier": job.tier,
        "totalFailures": 0,  # Will increment as jobs are added
        "totalJobs": total_jobs_for_type,
        "failedInParent": False,
        "isClassifiedIntermittent": False,  # Always False for fcid=6
        "isInvestigated": is_investigated,
        "investigatedTestId": investigated_test_id,
        "failedInJobs": [],  # Track which jobs failed for this test
    }


def has_job(job, job_list):
    return next((find_job for find_job in job_list if find_job["id"] == job.id), False)


def has_line(failure_line, log_line_list):
    return next(
        (find_line for find_line in log_line_list if find_line["line_number"] == failure_line.line),
        False,
    )


def get_test_failure_jobs(push):
    testfailed_jobs = (
        Job.objects.filter(
            push=push,
            tier__lte=2,
            result="testfailed",
        )
        .exclude(
            Q(machine_platform__platform="lint")
            | Q(job_type__symbol="mozlint")
            | Q(job_type__name__contains="build"),
        )
        .select_related("job_type", "machine_platform", "taskcluster_metadata")
    )
    failed_job_types = [job.job_type.name for job in testfailed_jobs]

    passing_jobs = Job.objects.filter(
        push=push, job_type__name__in=failed_job_types, result__in=["success", "unknown"]
    ).select_related("job_type", "machine_platform", "taskcluster_metadata")

    jobs = {}
    result_status = set()

    def add_jobs(job_list):
        for job in job_list:
            result_status.add(job.result)
            if job.job_type.name in jobs:
                jobs[job.job_type.name].append(job_to_dict(job))
            else:
                jobs[job.job_type.name] = [job_to_dict(job)]

    add_jobs(testfailed_jobs)
    add_jobs(passing_jobs)

    for job in jobs:
        (jobs[job]).sort(key=lambda x: x["start_time"])

    return (result_status, jobs)


def _build_jobs_dict(jobs_queryset):
    """
    Helper function to build jobs dictionary from queryset.
    Groups jobs by job_type.name and converts to dictionaries.
    """
    jobs = {}
    for job in jobs_queryset:
        job_dict = job_to_dict(job)
        job_type_name = job.job_type.name
        if job_type_name in jobs:
            jobs[job_type_name].append(job_dict)
        else:
            jobs[job_type_name] = [job_dict]

    # Sort jobs by start_time within each job type
    for job_type in jobs:
        jobs[job_type].sort(key=lambda x: x["start_time"])

    return jobs


def get_new_failure_jobs(push):
    """
    Get jobs for push health, filtering to only new failures (failure_classification_id=6).

    This function queries for all jobs in the push (for context and totals), then separately
    filters to only jobs with failure_classification_id=6 (new failures not classified).

    Returns:
        tuple: (all_jobs_dict, new_failure_jobs_dict, result_status)
        - all_jobs_dict: All testfailed/passing jobs grouped by job_type.name (for totals)
        - new_failure_jobs_dict: Only fcid=6 jobs grouped by job_type.name
        - result_status: Set of result values seen in new_failure_jobs
    """
    # Get all testfailed jobs (for calculating totals later)
    all_testfailed_jobs = (
        Job.objects.filter(
            push=push,
            tier__lte=2,
            result="testfailed",
        )
        .exclude(
            Q(machine_platform__platform="lint")
            | Q(job_type__symbol="mozlint")
            | Q(job_type__name__contains="build")
        )
        .select_related("job_type", "job_group", "machine_platform", "taskcluster_metadata")
    )

    # Get job types from all testfailed jobs (to fetch passing jobs of same types)
    all_failed_job_types = [job.job_type.name for job in all_testfailed_jobs]

    # Get passing jobs of the same types
    passing_jobs = Job.objects.filter(
        push=push, job_type__name__in=all_failed_job_types, result__in=["success", "unknown"]
    ).select_related("job_type", "job_group", "machine_platform", "taskcluster_metadata")

    # Build dictionary of ALL jobs (testfailed + passing) for context
    all_jobs_list = list(all_testfailed_jobs) + list(passing_jobs)
    all_jobs_dict = _build_jobs_dict(all_jobs_list)

    # Filter to ONLY jobs with failure_classification_id=6 (new failures)
    new_failure_jobs = all_testfailed_jobs.filter(failure_classification_id=6)
    new_failure_jobs_dict = _build_jobs_dict(new_failure_jobs)

    # Track result status from new failure jobs
    result_status = set(new_failure_jobs.values_list("result", flat=True))

    return (all_jobs_dict, new_failure_jobs_dict, result_status)


def get_test_failures(
    push,
    jobs,
    result_status=set(),
):
    """
    Get test failures for push health, filtered to only fcid=6 (new failures).

    Args:
        push: Push object
        jobs: Tuple of (all_jobs_dict, new_failure_jobs_dict) OR legacy dict for backward compatibility
        result_status: Set of result values

    Returns:
        tuple: (result_string, failures_dict) where failures_dict has 'needInvestigation' and 'knownIssues'
    """
    result = "pass"

    # Handle both new tuple format and legacy dict format for backward compatibility
    if isinstance(jobs, tuple):
        all_jobs_dict, new_failure_jobs_dict = jobs
    else:
        # Legacy format - treat as all_jobs_dict and new_failure_jobs_dict
        all_jobs_dict = jobs
        new_failure_jobs_dict = jobs

    if not len(new_failure_jobs_dict):
        return ("none", {"needInvestigation": [], "knownIssues": []})

    # option_map is used to map platforms for the job.option_collection_hash
    option_map = OptionCollection.objects.get_option_collection_map()
    investigated_tests = InvestigatedTests.objects.filter(push=push)

    # Query FailureLines ONLY for jobs with failure_classification_id=6
    # NOTE: Historical lookups (intermittent_history, fixed_by_commit_history) are REMOVED
    # for performance optimization when filtering to fcid=6 only
    new_failure_lines = (
        FailureLine.objects.filter(
            action__in=["test_result", "log", "crash"],
            job_log__job__push=push,
            job_log__job__failure_classification_id=6,  # NEW: Only fcid=6 jobs
            job_log__job__result="testfailed",
            job_log__job__tier__lte=2,
        )
        .exclude(
            Q(job_log__job__machine_platform__platform="lint")
            | Q(job_log__job__job_type__symbol="mozlint")
            | Q(job_log__job__job_type__name__contains="build")
        )
        .select_related(
            "job_log__job__job_type",
            "job_log__job__job_group",
            "job_log__job__machine_platform",
            "job_log__job__taskcluster_metadata",
        )
    )

    # DEBUG: Query TextLogErrors for the same push to understand correlation
    # Get all jobs in this push with fcid=6
    fcid6_jobs = Job.objects.filter(
        push=push,
        failure_classification_id=6,
        result="testfailed",
        tier__lte=2,
    ).exclude(
        Q(machine_platform__platform="lint")
        | Q(job_type__symbol="mozlint")
        | Q(job_type__name__contains="build")
    )

    # Load TextLogErrors with new_failure=True, optimized to only fetch needed fields
    new_failure_tles = TextLogError.objects.filter(job__in=fcid6_jobs, new_failure=True).values(
        "job_id", "line", "line_number", "id"
    )  # Only load what we need

    # Build lookup dict by job_id for efficient filtering
    tle_objects_by_job = defaultdict(list)
    for tle in new_failure_tles:
        tle_objects_by_job[tle["job_id"]].append(tle)

    # Filter FailureLines to only include those where test matches a TextLogError line_text
    # Also track which TextLogErrors were matched
    filtered_failure_lines = []
    matched_tle_ids = set()

    for fl in new_failure_lines:
        if fl.test:
            job_id = fl.job_log.job.id
            # Check if this FailureLine's test is a substring of any TextLogError line for this job
            for tle in tle_objects_by_job.get(job_id, []):
                if tle["line"] and fl.test in tle["line"]:
                    filtered_failure_lines.append(fl)
                    matched_tle_ids.add(tle["id"])
                    break  # FailureLine matched, move to next

    # Use filtered FailureLines for the rest of the processing
    new_failure_lines = filtered_failure_lines

    # Group failures by (test_name, platform, config, job_name)
    tests = {}
    all_failed_jobs = {}

    for failure_line in new_failure_lines:
        test_name = clean_test(failure_line.test, failure_line.signature, failure_line.message)

        if not test_name:
            continue

        # Extract job metadata
        job = failure_line.job_log.job
        config = clean_config(option_map[job.option_collection_hash])
        platform = clean_platform(job.machine_platform.platform)
        job_name = job.job_type.name
        job_group = job.job_group.name
        job.job_key = f"{config}{platform}{job_name}{job_group}"
        all_failed_jobs[job.id] = job

        # Generate unique key for this test+platform+config+job combination
        test_key = _generate_test_key(test_name, config, platform, job_name, job_group)

        # Check if test is investigated
        is_investigated, investigated_test_id = _check_investigation_status(
            test_name, job.job_type.id, investigated_tests
        )

        # Create test failure record if this is the first time seeing this test key
        if test_key not in tests:
            total_jobs_for_type = _count_total_jobs_for_type(job_name, all_jobs_dict)
            tests[test_key] = _create_test_failure_record(
                test_name,
                failure_line,
                job,
                config,
                platform,
                test_key,
                total_jobs_for_type,
                is_investigated,
                investigated_test_id,
            )

        # Track which jobs failed for this test (task-to-test matching)
        job_id = job.id
        if job_id not in tests[test_key]["failedInJobs"]:
            tests[test_key]["failedInJobs"].append(job_id)
            tests[test_key]["totalFailures"] += 1

    # Process unmatched TextLogErrors (e.g., from crashes without FailureLines)
    unmatched_tles = [tle for tle in new_failure_tles if tle["id"] not in matched_tle_ids]

    # Helper class to wrap TextLogError for _create_test_failure_record
    class TLEWrapper:
        def __init__(self, line_text):
            self.action = "log"  # Default to log action for TextLogErrors
            self.line = line_text

    if unmatched_tles:
        # Load full Job objects for unmatched TextLogErrors
        unmatched_job_ids = list(set(tle["job_id"] for tle in unmatched_tles))
        unmatched_jobs = Job.objects.filter(id__in=unmatched_job_ids).select_related(
            "job_type", "job_group", "machine_platform", "taskcluster_metadata"
        )
        jobs_by_id = {job.id: job for job in unmatched_jobs}

        for tle in unmatched_tles:
            # Parse test name from TextLogError line text
            # The line typically follows the format:
            # "timestamp  LEVEL -  TEST-UNEXPECTED-FAIL | test/path | ..."
            line_text = tle["line"] or ""
            test_name = None

            # Skip lines that are not actual test failures
            # These are crash/error messages without test names
            if "TEST-UNEXPECTED-" not in line_text:
                continue

            # Try to extract test name from pipe-delimited format first
            if "|" in line_text:
                parts = line_text.split("|")
                if len(parts) >= 2:
                    # The test path is usually in the second part (index 1)
                    potential_test = parts[1].strip()
                    # Clean it further using the clean_test function
                    test_name = clean_test(potential_test, None, None)

            # If pipe parsing didn't work, try clean_test on the whole line
            if not test_name:
                test_name = clean_test(line_text, None, None)

            if not test_name:
                continue

            # Get job metadata
            job = jobs_by_id.get(tle["job_id"])
            if not job:
                continue

            config = clean_config(option_map[job.option_collection_hash])
            platform = clean_platform(job.machine_platform.platform)
            job_name = job.job_type.name
            job_group = job.job_group.name
            job.job_key = f"{config}{platform}{job_name}{job_group}"
            all_failed_jobs[job.id] = job

            # Generate unique key for this test+platform+config+job combination
            test_key = _generate_test_key(test_name, config, platform, job_name, job_group)

            # Check if test is investigated
            is_investigated, investigated_test_id = _check_investigation_status(
                test_name, job.job_type.id, investigated_tests
            )

            # Create test failure record if this is the first time seeing this test key
            if test_key not in tests:
                total_jobs_for_type = _count_total_jobs_for_type(job_name, all_jobs_dict)
                tle_wrapper = TLEWrapper(tle["line"])
                tests[test_key] = _create_test_failure_record(
                    test_name,
                    tle_wrapper,
                    job,
                    config,
                    platform,
                    test_key,
                    total_jobs_for_type,
                    is_investigated,
                    investigated_test_id,
                )

            # Track which jobs failed for this test
            job_id = job.id
            if job_id not in tests[test_key]["failedInJobs"]:
                tests[test_key]["failedInJobs"].append(job_id)
                tests[test_key]["totalFailures"] += 1

    # Each line represents one test file per platform/config with at least one failing job
    push_failures = sorted(tests.values(), key=lambda k: k["testName"])

    filtered_push_failures = [failure for failure in push_failures if filter_failure(failure)]

    # SIMPLIFIED: All fcid=6 failures go to needInvestigation
    # No historical classification needed since we're focused on new failures
    failures = {
        "needInvestigation": filtered_push_failures,
        "knownIssues": [],  # Empty - not used for fcid=6 filtering
    }

    if len(failures["needInvestigation"]):
        result = "fail"
    elif "unknown" in result_status:
        result = "unknown"

    return (result, failures)


def get_test_in_progress_count(push):
    test_types = JobType.objects.exclude(
        name__contains="build",
        symbol="mozlint",
    )
    return (
        Job.objects.filter(
            push=push,
            tier__lte=2,
            result="unknown",
            job_type__in=test_types,
        )
        .exclude(machine_platform__platform="lint")
        .select_related("machine_platform")
        .count()
    )
