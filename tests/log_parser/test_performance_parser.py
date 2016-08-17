import json

from treeherder.log_parser.parsers import PerformanceParser


def test_performance_log_parsing_malformed_perfherder_data():
    """
    If we have malformed perfherder data lines, we should just ignore
    them and still be able to parse the valid ones
    """
    parser = PerformanceParser()

    # invalid json
    parser.parse_line("PERFHERDER_DATA: {oh noes i am not valid json}", 1)
    # doesn't comply with schema
    parser.parse_line("PERFHERDER_DATA: {}", 2)

    valid_perfherder_data = {
        "framework": {"name": "talos"}, "suites": [{
            "name": "basic_compositor_video",
            "subtests": [{
                "name": "240p.120fps.mp4_scale_fullscreen_startup",
                "value": 1234
            }]
        }]
    }
    parser.parse_line('PERFHERDER_DATA: {}'.format(
        json.dumps(valid_perfherder_data)), 3)

    assert parser.get_artifact() == [valid_perfherder_data]
