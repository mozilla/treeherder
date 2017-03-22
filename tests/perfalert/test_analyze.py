import os

import pytest

from tests.sampledata import SampleData
from treeherder.perfalert.perfalert import (Datum,
                                            analyze,
                                            calc_t,
                                            default_weights,
                                            detect_changes,
                                            linear_weights)


def test_analyze():
    assert analyze([]) == {"avg": 0.0, "n": 0, "variance": 0.0}
    assert analyze([3.0]) == {"avg": 3.0, "n": 1, "variance": 0.0}
    assert analyze([1.0, 2.0, 3.0, 4.0]) == {"avg": 2.5, "n": 4,
                                             "variance": 5.0/3.0}
    assert analyze([1.0, 2.0, 3.0, 4.0], linear_weights) == {"avg": 2.0,
                                                             "n": 4,
                                                             "variance": 2.0}


def test_weights():
    assert [default_weights(i, 5) for i in range(5)] == [1.0, 1.0, 1.0, 1.0, 1.0]
    assert [linear_weights(i, 5) for i in range(5)] == [1.0, 0.8, 0.6, 0.4, 0.2]


def test_calc_t():
    assert calc_t([0.0, 0.0], [1.0, 2.0]) == 3.0
    assert calc_t([0.0, 0.0], [0.0, 0.0]) == 0.0
    assert calc_t([0.0, 0.0], [1.0, 1.0]) == float('inf')


def test_detect_changes():
    data = []

    times = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    values = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1,  1,  1,  1,  1,  1,  1]
    for (t, v) in zip(times, values):
        data.append(Datum(t, float(v)))

    result = [(d.push_timestamp, d.state) for d in
              detect_changes(data, min_back_window=5, max_back_window=5,
                             fore_window=5, t_threshold=2)]
    assert result == [
        (1, 'good'),
        (2, 'good'),
        (3, 'good'),
        (4, 'good'),
        (5, 'good'),
        (6, 'good'),
        (7, 'good'),
        (8, 'regression'),
        (9, 'good'),
        (10, 'good')
    ]


@pytest.mark.parametrize(("filename", "expected_timestamps"), [
    ('runs1.json', [1365019665]),
    ('runs2.json', [1357704596, 1358971894, 1365014104]),
    ('runs3.json', [1335293827, 1338839958]),
    ('runs4.json', [1364922838]),
    ('runs5.json', []),
    ('a11y.json', [1366197637, 1367799757]),
    ('tp5rss.json', [1372846906, 1373413365, 1373424974])
    ])
def test_detect_changes_historical_data(filename, expected_timestamps):
    """Parse JSON produced by http://graphs.mozilla.org/api/test/runs"""
    # Configuration for Analyzer
    FORE_WINDOW = 12
    MIN_BACK_WINDOW = 12
    MAX_BACK_WINDOW = 24
    THRESHOLD = 7

    payload = SampleData.get_perf_data(os.path.join('graphs', filename))
    runs = payload['test_runs']
    data = []
    for r in runs:
        data.append(Datum(r[2], r[3], testrun_id=r[0],
                          revision_id=r[1][2]))

    results = detect_changes(data, min_back_window=MIN_BACK_WINDOW,
                             max_back_window=MAX_BACK_WINDOW,
                             fore_window=FORE_WINDOW,
                             t_threshold=THRESHOLD)
    regression_timestamps = [d.push_timestamp for d in results if
                             d.state == 'regression']
    assert regression_timestamps == expected_timestamps
