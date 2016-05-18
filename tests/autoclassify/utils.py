import json
import zlib

from mozlog.formatters.tbplformatter import TbplFormatter

from treeherder.model.derived.artifacts import ArtifactsModel
from treeherder.model.models import (FailureLine,
                                     MatcherManager)

test_line = {"action": "test_result", "test": "test1", "subtest": "subtest1",
             "status": "FAIL", "expected": "PASS", "message": "message1"}
log_line = {"action": "log", "level": "ERROR", "message": "message1"}
crash_line = {"action": "crash", "signature": "signature"}


def create_failure_lines(repository, job_guid, failure_line_list):
    failure_lines = []
    for i, (base_data, updates) in enumerate(failure_line_list):
        data = {"job_guid": job_guid,
                "repository": repository,
                "line": i}
        data.update(base_data)
        data.update(updates)
        failure_line = FailureLine(**data)
        failure_line.save()
        failure_line.elastic_search_insert()
        failure_lines.append(failure_line)

    return failure_lines


def create_bug_suggestions(job, project, *bug_suggestions):
    for item in bug_suggestions:
        for key in ["search_terms", "bugs"]:
            if key not in item:
                item[key] = []

    bug_suggestions_placeholders = [
        job["id"], 'Bug suggestions',
        'json', zlib.compress(json.dumps(bug_suggestions)),
        job["id"], 'Bug suggestions',
    ]

    with ArtifactsModel(project) as artifacts_model:
        artifacts_model.store_job_artifact([bug_suggestions_placeholders])


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
        if data["level"] not in ("error", "critical"):
            return
    else:
        return
    return data


def create_summary_lines_failures(project, job, failure_line_list):
    formatter = TbplFormatter()

    text_log_summary = {"logurl": "http://example.org/log-test/",
                        "step_data": {"all_errors": [],
                                      "steps": [],
                                      "errors_truncated": False},
                        }

    for i, (base_data, updates) in enumerate(failure_line_list):
        data = get_data(base_data, updates)
        if not data:
            continue

        text_log_summary["step_data"]["all_errors"].append(
            {"line": formatter(data).split("\n")[0],
             "linenumber": i})

    print text_log_summary

    placeholders = [job["id"], 'text_log_summary',
                    'json', zlib.compress(json.dumps(text_log_summary)),
                    job["id"], 'text_log_summary']

    with ArtifactsModel(project) as artifacts_model:
        artifacts_model.store_job_artifact([placeholders])
        return artifacts_model.get_job_artifact_list(
            0, 1, {'job_id': set([('=', job['id'])]),
                   "name": set([("=", "text_log_summary")])})[0]


def create_bug_suggestions_failures(project, job, failure_line_list):
    formatter = TbplFormatter()

    bug_suggestions = []

    for i, (base_data, updates) in enumerate(failure_line_list):
        data = get_data(base_data, updates)
        if not data:
            continue

        bug_suggestions.append(
            {"search": formatter(data).split("\n")[0],
             "bugs": {"all_others": [],
                      "open_recent": []}})

    placeholders = [job["id"], 'Bug suggestions',
                    'json', zlib.compress(json.dumps(bug_suggestions)),
                    job["id"], 'Bug suggestions']

    with ArtifactsModel(project) as artifacts_model:
        artifacts_model.store_job_artifact([placeholders])
        return artifacts_model.get_job_artifact_list(
            0, 1, {'job_id': set([('=', job['id'])]),
                   "name": set([("=", "Bug suggestions")])})[0]


def register_matchers(*args):
    MatcherManager._matcher_funcs = {}
    for item in args:
        MatcherManager.register_matcher(item)


def register_detectors(*args):
    MatcherManager._detector_funcs = {}
    for item in args:
        MatcherManager.register_detector(item)
