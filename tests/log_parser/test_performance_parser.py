import json

from treeherder.log_parser.parsers import EmptyPerformanceDataError, PerformanceParser


def test_performance_log_parsing_malformed_perfherder_data():
    """
    If we have malformed perfherder data lines, we should just ignore
    them and still be able to parse the valid ones
    """
    parser = PerformanceParser()

    # invalid json
    parser.parse_line("PERFHERDER_DATA: {oh noes i am not valid json}", 1)
    try:
        # Empty performance data
        parser.parse_line("PERFHERDER_DATA: {}", 2)
    except EmptyPerformanceDataError:
        pass

    valid_perfherder_data = {
        "framework": {"name": "talos"},
        "suites": [
            {
                "name": "basic_compositor_video",
                "subtests": [{"name": "240p.120fps.mp4_scale_fullscreen_startup", "value": 1234}],
            }
        ],
    }
    parser.parse_line(f"PERFHERDER_DATA: {json.dumps(valid_perfherder_data)}", 3)

    assert parser.get_artifact() == [valid_perfherder_data]


def test_performance_log_parsing_skips_oversized_line(caplog, monkeypatch):
    """A PERFHERDER_DATA line longer than the cap is skipped (with a warning)
    before any JSON parsing or schema validation, and parsing continues."""
    from treeherder.log_parser import parsers

    monkeypatch.setattr(parsers, "MAX_PERFHERDER_DATA_LINE_LENGTH", 1000)
    parser = PerformanceParser()

    huge = {
        "framework": {"name": "talos"},
        "suites": [{"name": "s", "subtests": [{"name": f"t{i}", "value": i} for i in range(200)]}],
    }
    huge_line = f"PERFHERDER_DATA: {json.dumps(huge)}"
    assert len(huge_line) > 1000

    small = {
        "framework": {"name": "talos"},
        "suites": [{"name": "s", "subtests": [{"name": "t", "value": 1}]}],
    }

    with caplog.at_level("WARNING"):
        parser.parse_line(huge_line, 1)
        parser.parse_line(f"PERFHERDER_DATA: {json.dumps(small)}", 2)

    assert parser.get_artifact() == [small]
    assert any("PERFHERDER_DATA" in r.message and "1000" in r.message for r in caplog.records)


def test_performance_log_parsing_long_non_perf_line_ignored_cheaply(monkeypatch):
    """Long lines that are not PERFHERDER_DATA are ignored without warning."""
    from treeherder.log_parser import parsers

    monkeypatch.setattr(parsers, "MAX_PERFHERDER_DATA_LINE_LENGTH", 100)
    parser = PerformanceParser()
    parser.parse_line("INFO - " + "x" * 500, 1)
    assert parser.get_artifact() == []
