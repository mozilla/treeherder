import json

import pytest
import responses
from django.conf import settings
from requests.exceptions import HTTPError

from treeherder.log_parser.failureline import get_group_results, write_failure_lines
from treeherder.log_parser.tasks import store_failure_lines
from treeherder.model.models import FailureLine, Group, GroupStatus, Job, JobLog

from ..sampledata import SampleData


def test_store_error_summary(activate_responses, test_repository, test_job):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    store_failure_lines(log_obj)

    assert FailureLine.objects.count() == 1

    failure = FailureLine.objects.get(pk=1)

    assert failure.job_guid == test_job.guid

    assert failure.repository == test_repository


def test_store_error_summary_default_group(activate_responses, test_repository, test_job):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        resp_body = json.load(log_handler)

    resp_body["group"] = "default"
    responses.add(responses.GET, log_url, body=json.dumps(resp_body), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    store_failure_lines(log_obj)

    assert FailureLine.objects.count() == 1


def test_store_error_summary_truncated(activate_responses, test_repository, test_job, monkeypatch):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary_10_lines.log")
    log_url = "http://my-log.mozilla.org"

    monkeypatch.setattr(settings, "FAILURE_LINES_CUTOFF", 5)

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    store_failure_lines(log_obj)

    assert FailureLine.objects.count() == 5 + 1

    failure = FailureLine.objects.get(action="truncated")

    assert failure.job_guid == test_job.guid

    assert failure.repository == test_repository


def test_store_error_summary_astral(activate_responses, test_repository, test_job):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary_astral.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path, encoding="utf8") as log_handler:
        responses.add(
            responses.GET,
            log_url,
            content_type="text/plain;charset=utf-8",
            body=log_handler.read(),
            status=200,
        )

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    store_failure_lines(log_obj)

    assert FailureLine.objects.count() == 1

    failure = FailureLine.objects.get(pk=1)

    assert failure.job_guid == test_job.guid

    assert failure.repository == test_repository

    assert (
        failure.test == "toolkit/content/tests/widgets/test_videocontrols_video_direction.html 🍆"
    )
    assert failure.subtest == "Test timed out. 𐂁"
    assert failure.message == "󰅑"
    assert failure.stack.endswith("󰅑")
    assert failure.stackwalk_stdout is None
    assert failure.stackwalk_stderr is None


def test_store_error_summary_404(activate_responses, test_repository, test_job):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=404)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    store_failure_lines(log_obj)

    log_obj.refresh_from_db()
    assert log_obj.status == JobLog.FAILED


def test_store_error_summary_500(activate_responses, test_repository, test_job):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=500)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    with pytest.raises(HTTPError):
        store_failure_lines(log_obj)

    log_obj.refresh_from_db()
    assert log_obj.status == JobLog.FAILED


def test_store_error_summary_duplicate(activate_responses, test_repository, test_job, mock_parser):
    log_url = "http://my-log.mozilla.org"
    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    write_failure_lines(
        log_obj, [{"action": "log", "level": "debug", "message": "test", "line": 1}]
    )
    write_failure_lines(
        log_obj,
        [
            {"action": "log", "level": "debug", "message": "test", "line": 1},
            {"action": "log", "level": "debug", "message": "test 1", "line": 2},
        ],
    )

    assert FailureLine.objects.count() == 2


def test_store_error_summary_group_status(activate_responses, test_repository, test_job):
    log_path = SampleData().get_log_path("mochitest-browser-chrome_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)
    store_failure_lines(log_obj)

    assert FailureLine.objects.count() == 5

    ok_groups = Group.objects.filter(group_result__status=GroupStatus.OK)
    error_groups = Group.objects.filter(group_result__status=GroupStatus.ERROR)

    assert ok_groups.count() == 26
    assert error_groups.count() == 3
    assert log_obj.groups.count() == 29

    assert log_obj.groups.all().first().name == "dom/base/test/browser.ini"
    assert ok_groups.first().name == "dom/base/test/browser.ini"
    assert error_groups.first().name == "dom/workers/test/browser.ini"


def test_group_status_duration(activate_responses, test_repository, test_job):
    log_path = SampleData().get_log_path("mochitest-browser-chrome_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)
    store_failure_lines(log_obj)

    assert FailureLine.objects.count() == 5

    ok_groups = Group.objects.filter(group_result__duration__gt=0)
    error_groups = Group.objects.filter(group_result__duration=0)

    assert ok_groups.count() == 27
    assert error_groups.count() == 2
    assert log_obj.groups.count() == 29


def test_get_group_results(activate_responses, test_job):
    log_path = SampleData().get_log_path("mochitest-browser-chrome_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)
    store_failure_lines(log_obj)

    groups = get_group_results(test_job.push)
    task_groups = groups["V3SVuxO8TFy37En_6HcXLs"]

    assert task_groups["dom/base/test/browser.ini"]


def test_get_group_results_with_colon(activate_responses, test_job):
    log_path = SampleData().get_log_path("xpcshell-errorsummary-with-colon.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)
    store_failure_lines(log_obj)

    groups = get_group_results(test_job.push)
    task_groups = groups["V3SVuxO8TFy37En_6HcXLs"]

    assert task_groups[
        "toolkit/components/extensions/test/xpcshell/xpcshell-e10s.ini:toolkit/components/extensions/test/xpcshell/xpcshell-content.ini"
    ]
    assert task_groups["toolkit/components/places/tests/unit/xpcshell.ini"]
    assert task_groups[
        "toolkit/components/extensions/test/xpcshell/xpcshell-e10s.ini:toolkit/components/extensions/test/xpcshell/xpcshell-common-e10s.ini"
    ]


def mock_full_log_parser(job_logs, mock_parser):
    from treeherder.log_parser.tasks import store_failure_lines

    try:
        # note: I was using parse_logs, but that is less deterministic
        for jl in job_logs:
            # if job is already parsed
            matching = JobLog.objects.filter(job_id=jl.job.id, name=jl.name, status__in=(1, 3))
            if len(matching) == 1:
                continue

            store_failure_lines(jl)
    except:
        raise


def create_errorsummary_job(base_job, create_jobs, log_filenames):
    import copy
    import random

    job_defs = []
    urls = []
    for log_filename in log_filenames:
        log_path = SampleData().get_log_path(log_filename)
        log_url = f"http://my-log.mozilla.org/{log_path}"

        with open(log_path) as log_handler:
            responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

        job_def = copy.deepcopy(base_job)

        task_ending = ""
        if "_cf" in log_filename:
            task_ending = "-cf"

        job_def["job"].update(
            {
                "status": "completed",
                "result": "success" if "_pass" in log_filename else "testfailed",
                "name": f"{job_def['job']['name']}{task_ending}",
                "reference_data_name": job_def["job"]["reference_data_name"].replace(
                    "a", str(random.randint(0, 9))
                ),
                "job_guid": job_def["job"]["job_guid"]
                .replace("e", str(random.randint(0, 9)))
                .replace("d", str(random.randint(0, 9))),
                "start_timestamp": job_def["job"]["start_timestamp"]
                + 100
                + random.randint(0, 100)
                + random.randint(0, 100),
                "taskcluster_task_id": job_def["job"]["taskcluster_task_id"].replace(
                    "T", str(random.randint(0, 9))
                ),
                "taskcluster_retry_id": "0",
            }
        )
        job_defs.append(job_def)
        urls.append(log_url)

    jobs = create_jobs(job_defs)

    index = 0
    for job in jobs:
        log_obj = JobLog.objects.create(job=job, name="errorsummary_json", url=urls[index])
        store_failure_lines(log_obj)
        index += 1

    return jobs


def verify_classification_id(jobs, job1_fcid, job2_fcid):
    j1 = Job.objects.filter(id=jobs[0].id)
    j2 = Job.objects.filter(id=jobs[1].id)
    assert j1[0].failure_classification.id == job1_fcid
    assert j2[0].failure_classification.id == job2_fcid


"""
TODO: test multiple push ids
"""


def test_infra_no_intermittent(activate_responses, hundred_job_blobs, mock_parser, create_jobs):
    # test fails, retrigger fails on infra, both unchanged
    log_filenames = [
        "mochitest-browser-chrome_errorsummary.log",
        "mochitest-browser-chrome_infra_errorsummary.log",
    ]
    jobs = create_errorsummary_job(hundred_job_blobs[0], create_jobs, log_filenames)
    job_logs = JobLog.objects.filter(job_id__in=(j.id for j in jobs))
    assert len(jobs) == len(log_filenames)

    # this will parse and check for intermittents
    mock_full_log_parser(job_logs, mock_parser)
    verify_classification_id(jobs, 1, 8)


def test_infra_intermittent(activate_responses, hundred_job_blobs, mock_parser, create_jobs):
    # test passes, retrigger is infra, infra -> unchanged (new feature needed to make intermittent)
    log_filenames = [
        "mochitest-browser-chrome_infra_errorsummary.log",
        "mochitest-browser-chrome_pass_errorsummary.log",
    ]
    jobs = create_errorsummary_job(hundred_job_blobs[0], create_jobs, log_filenames)
    job_logs = JobLog.objects.filter(job_id__in=(j.id for j in jobs))
    assert len(jobs) == len(log_filenames)

    # this will parse and check for intermittents
    mock_full_log_parser(job_logs, mock_parser)
    verify_classification_id(jobs, 8, 1)


def test_multiple_jobs_intermittent(
    activate_responses, hundred_job_blobs, mock_parser, create_jobs
):
    # two sets of tests fail, both failures should be intermittent
    log_filenames = [
        "mochitest-browser-chrome_errorsummary.log",
        "mochitest-browser-chrome_2_errorsummary.log",
        "mochitest-browser-chrome_pass_errorsummary.log",
    ]
    jobs = create_errorsummary_job(hundred_job_blobs[0], create_jobs, log_filenames)
    job_logs = JobLog.objects.filter(job_id__in=(j.id for j in jobs))
    assert len(jobs) == len(log_filenames)

    # this will parse and check for intermittents
    mock_full_log_parser(job_logs, mock_parser)
    verify_classification_id(jobs, 8, 8)


def test_confirm_failure_no_intermittent(
    activate_responses, hundred_job_blobs, mock_parser, create_jobs
):
    # test fails, -cf fails on same group, both unchanged
    log_filenames = [
        "mochitest-browser-chrome_errorsummary.log",
        "mochitest-browser-chrome_cf1_errorsummary.log",
        "mochitest-browser-chrome_cf2_errorsummary.log",
    ]
    jobs = create_errorsummary_job(hundred_job_blobs[0], create_jobs, log_filenames)
    job_logs = JobLog.objects.filter(job_id__in=(j.id for j in jobs))
    assert len(jobs) == len(log_filenames)

    # this will parse and check for intermittents
    mock_full_log_parser(job_logs, mock_parser)
    verify_classification_id(jobs, 1, 1)


def test_confirm_failure_partial_intermittent(
    activate_responses, hundred_job_blobs, mock_parser, create_jobs
):
    # test fails, -cf fails on same group, both unchanged
    log_filenames = [
        "mochitest-browser-chrome_errorsummary.log",
        "mochitest-browser-chrome_cf1_errorsummary.log",
    ]
    jobs = create_errorsummary_job(hundred_job_blobs[0], create_jobs, log_filenames)
    job_logs = JobLog.objects.filter(job_id__in=(j.id for j in jobs))
    assert len(jobs) == len(log_filenames)

    # this will parse and check for intermittents
    mock_full_log_parser(job_logs, mock_parser)
    verify_classification_id(jobs, 1, 1)


def test_confirm_failure_pass_intermittent(
    activate_responses, hundred_job_blobs, mock_parser, create_jobs
):
    # test fails, -cf passes, original -> intermittent
    log_filenames = [
        "mochitest-browser-chrome_errorsummary.log",
        "mochitest-browser-chrome_cf1_pass_errorsummary.log",
        "mochitest-browser-chrome_cf2_pass_errorsummary.log",
        "mochitest-browser-chrome_cf3_pass_errorsummary.log",
    ]
    jobs = create_errorsummary_job(hundred_job_blobs[0], create_jobs, log_filenames)
    job_logs = JobLog.objects.filter(job_id__in=(j.id for j in jobs))
    assert len(jobs) == len(log_filenames)

    # this will parse and check for intermittents
    mock_full_log_parser(job_logs, mock_parser)
    verify_classification_id(jobs, 8, 1)


def test_retrigger_no_intermittent(activate_responses, hundred_job_blobs, mock_parser, create_jobs):
    # test fails, retrigger fails on same group, both unchanged
    log_filenames = [
        "mochitest-browser-chrome_errorsummary.log",
        "mochitest-browser-chrome_errorsummary.log",
    ]
    jobs = create_errorsummary_job(hundred_job_blobs[0], create_jobs, log_filenames)
    job_logs = JobLog.objects.filter(job_id__in=(j.id for j in jobs))
    assert len(jobs) == len(log_filenames)

    # this will parse and check for intermittents
    mock_full_log_parser(job_logs, mock_parser)
    verify_classification_id(jobs, 1, 1)


def test_retrigger_intermittent(activate_responses, hundred_job_blobs, mock_parser, create_jobs):
    # test fails, retrigger has different failures on same group, both -> intermittent
    log_filenames = [
        "mochitest-browser-chrome_errorsummary.log",
        "mochitest-browser-chrome_2_errorsummary.log",
    ]
    jobs = create_errorsummary_job(hundred_job_blobs[0], create_jobs, log_filenames)
    job_logs = JobLog.objects.filter(job_id__in=(j.id for j in jobs))
    assert len(jobs) == len(log_filenames)

    # this will parse and check for intermittents
    mock_full_log_parser(job_logs, mock_parser)
    verify_classification_id(jobs, 8, 8)
