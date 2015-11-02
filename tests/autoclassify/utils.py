from treeherder.model.models import FailureLine

test_line = {"action": "test_result", "test": "test1", "subtest": "subtest1",
             "status": "FAIL", "expected": "PASS", "message": "message1"}


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
