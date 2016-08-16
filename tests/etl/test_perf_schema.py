import json

import jsonschema
import pytest


@pytest.mark.parametrize(('suite_value', 'test_value', 'expected_fail'),
                         [({}, {}, True),
                          ({'value': 1234}, {}, True),
                          ({}, {'value': 1234}, False),
                          ({'value': 1234}, {'value': 1234}, False),
                          ({'value': float('inf')}, {}, True),
                          ({}, {'value': float('inf')}, True)])
def test_perf_schema(suite_value, test_value, expected_fail):
    perf_schema = json.load(open('schemas/performance-artifact.json'))
    datum = {
        "framework": {"name": "talos"}, "suites": [{
            "name": "basic_compositor_video",
            "subtests": [{
                "name": "240p.120fps.mp4_scale_fullscreen_startup"
            }]
        }]
    }
    datum['suites'][0].update(suite_value)
    datum['suites'][0]['subtests'][0].update(test_value)
    print datum
    if expected_fail:
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(datum, perf_schema)
    else:
        jsonschema.validate(datum, perf_schema)
