import json

from treeherder.model.derived.artifacts import ArtifactsModel
from treeherder.model.models import (FailureLine,
                                     Matcher)

test_line = {"action": "test_result", "test": "test1", "subtest": "subtest1",
             "status": "FAIL", "expected": "PASS", "message": "message1"}
log_line = {"action": "log", "level": "ERROR", "message": "message1"}


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
        failure_lines.append(failure_line)

    return failure_lines


def create_bug_suggestions(job, project, *bug_suggestions):
    for item in bug_suggestions:
        for key in ["search_terms", "bugs"]:
            if key not in item:
                item[key] = []

    bug_suggestions_placeholders = [
        job["id"], 'Bug suggestions',
        'json', json.dumps(bug_suggestions),
        job["id"], 'Bug suggestions',
    ]

    with ArtifactsModel(project) as artifacts_model:
        artifacts_model.store_job_artifact([bug_suggestions_placeholders])


def register_matchers(*args):
    Matcher._matcher_funcs = {}
    for item in args:
        Matcher.objects.register_matcher(item)


def register_detectors(*args):
    Matcher._detector_funcs = {}
    for item in args:
        Matcher.objects.register_detector(item)
