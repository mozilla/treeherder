from treeherder.log_parser.parsers import PerformanceParser


def test_performance_log_parsing_malformed_perfherder_data():
    """
    If we have one malformed perfherder data line, we should just ignore
    it and still be able to parse the next one
    """
    parser = PerformanceParser()
    parser.parse_line("PERFHERDER_DATA: {oh noes i am not valid json}", 1)
    parser.parse_line("PERFHERDER_DATA: {}", 2)
    assert parser.get_artifact() == [{}]
