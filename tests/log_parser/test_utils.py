import os
from copy import deepcopy

import pytest
import simplejson as json
from django.db.utils import DataError
from jsonschema import ValidationError

from treeherder.log_parser.utils import (
    MAX_LENGTH,
    SECOND_MAX_LENGTH,
    _lookup_extra_options_max,
    validate_perf_data,
)

LENGTH_OK = {
    'framework': {},
    'suites': [{'extraOptions': ['.' * 45, '.' * 100,], 'name': 'testing', 'subtests': []}] * 3,
}

LONGER_THAN_ALL_MAX = {
    'framework': {},
    'suites': [{'extraOptions': ['.' * 46, '.' * 101,], 'name': 'testing', 'subtests': []}],
}

LONGER_THAN_BIGGER_MAX = {
    'framework': {},
    'suites': [{'extraOptions': ['.' * 45, '.' * 101,], 'name': 'testing', 'subtests': []}],
}

LONGER_THAN_SMALLER_MAX = {
    'framework': {},
    'suites': [{'extraOptions': ['.' * 46, '.' * 100,], 'name': 'testing', 'subtests': []}] * 3,
}


def test_smaller_than_bigger():
    assert SECOND_MAX_LENGTH < MAX_LENGTH


def test_extra_option_max_length():
    with open(os.path.join('schemas', 'performance-artifact.json')) as f:
        PERFHERDER_SCHEMA = json.load(f)
    assert 100 == _lookup_extra_options_max(PERFHERDER_SCHEMA)


def test_validate_perf_schema_no_exception():
    try:
        validate_perf_data(deepcopy(LENGTH_OK))
    except ValidationError as exc:
        pytest.fail(str(exc))


@pytest.mark.parametrize(
    'data', (LONGER_THAN_ALL_MAX, LONGER_THAN_BIGGER_MAX, LONGER_THAN_SMALLER_MAX)
)
def test_validate_perf_schema(data):
    for datum in data:
        with pytest.raises(ValidationError):
            validate_perf_data(deepcopy(datum))


def test_model_insert(test_perf_signature):
    # check for database field insertion errors
    maxed_out_extra_options = ["." * 45 for _ in range(7)] + ["." * 100]
    test_perf_signature.extra_options = " ".join(maxed_out_extra_options)
    test_perf_signature.save()


def test_model_insert_too_long_string(test_perf_signature):
    # check for database field insertion errors
    too_long_extra_options = ["." * 46 for _ in range(7)] + ["." * 100]
    test_perf_signature.extra_options = " ".join(too_long_extra_options)
    with pytest.raises(DataError):
        test_perf_signature.save()
