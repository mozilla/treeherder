import json


def get_test_paths(task):
    test_paths = []
    mozharness_test_path = task['payload']['env'].get('MOZHARNESS_TEST_PATHS')
    if mozharness_test_path:
        test_paths = [*json.loads(task['payload']['env'].get('MOZHARNESS_TEST_PATHS')).values()][0]
    return test_paths
