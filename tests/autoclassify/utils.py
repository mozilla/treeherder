import datetime

from mozlog.formatters.tbplformatter import TbplFormatter

from treeherder.model.models import (FailureLine,
                                     Job,
                                     MatcherManager,
                                     TextLogError,
                                     TextLogErrorMetadata,
                                     TextLogStep)
from treeherder.model.search import refresh_all

test_line = {"action": "test_result", "test": "test1", "subtest": "subtest1",
             "status": "FAIL", "expected": "PASS", "message": "message1"}
log_line = {"action": "log", "level": "ERROR", "message": "message1"}
crash_line = {"action": "crash", "signature": "signature", "test": "test1"}


def create_lines(test_job, lines):
    error_lines = create_text_log_errors(test_job, lines)
    failure_lines = create_failure_lines(test_job, lines)

    for error_line, failure_line in zip(error_lines, failure_lines):
        TextLogErrorMetadata.objects.create(text_log_error=error_line,
                                            failure_line=failure_line)

    test_job.autoclassify_status = Job.CROSSREFERENCED
    test_job.save()

    return error_lines, failure_lines


def create_failure_lines(job, failure_line_list,
                         start_line=0):
    failure_lines = []
    for i, (base_data, updates) in enumerate(failure_line_list[start_line:]):
        data = {"job_guid": job.guid,
                "repository": job.repository,
                "line": i + start_line}
        data.update(base_data)
        data.update(updates)
        failure_line = FailureLine(**data)
        failure_line.save()
        failure_line.elastic_search_insert()
        failure_lines.append(failure_line)

    refresh_all()

    return failure_lines


def get_data(base_data, updates):
    data = base_data.copy()
    data.update(updates)
    if data["action"] == "test_result":
        if "expected" not in data or data["status"] == data["expected"]:
            return
        if data["subtest"]:
            data["action"] = "test_status"
        else:
            data["action"] = "test_end"
    elif data["action"] == "log":
        if data["level"] not in ("ERROR", "CRITICAL"):
            return
    elif data["action"] == "crash":
        pass
    else:
        return
    return data


def create_text_log_errors(job, failure_line_list):
    step = TextLogStep.objects.create(
        job=job,
        name='everything',
        started_line_number=1,
        finished_line_number=10,
        started=datetime.datetime.now(),
        finished=datetime.datetime.now(),
        result=TextLogStep.TEST_FAILED)

    formatter = TbplFormatter()
    errors = []
    for i, (base_data, updates) in enumerate(failure_line_list):
        data = get_data(base_data, updates)
        if not data:
            continue
        error = TextLogError.objects.create(step=step,
                                            line=formatter(data).split("\n")[0],
                                            line_number=i)
        errors.append(error)

    return errors


def register_matchers(*args):
    MatcherManager._matcher_funcs = {}
    for item in args:
        MatcherManager.register_matcher(item)


def register_detectors(*args):
    MatcherManager._detector_funcs = {}
    for item in args:
        MatcherManager.register_detector(item)
