import os

import simplejson as json
from jsonschema import ValidationError, validate


def _lookup_extra_options_max(schema):
    return schema["definitions"]["suite_schema"]["properties"]["extraOptions"]["items"]["maxLength"]


with open(os.path.join('schemas', 'performance-artifact.json')) as f:
    PERFHERDER_SCHEMA = json.load(f)
    MAX_LENGTH = _lookup_extra_options_max(PERFHERDER_SCHEMA)
    SECOND_MAX_LENGTH = 45


def validate_perf_data(performance_data: dict):
    validate(performance_data, PERFHERDER_SCHEMA)

    expected_range = (SECOND_MAX_LENGTH, MAX_LENGTH)
    for suite in performance_data["suites"]:
        # allow only one extraOption longer than 45
        if len(_long_options(_extra_options(suite), *expected_range)) > 1:
            raise ValidationError("Too many extra options longer than {}".format(SECOND_MAX_LENGTH))


def _long_options(all_extra_options: list, second_max: int, first_max: int):
    long_elements = []
    for element in all_extra_options:
        if second_max < len(element) < first_max + 1:
            long_elements.append(element)
    return long_elements


def _extra_options(suite: dict):
    return suite.get("extraOptions", [])
