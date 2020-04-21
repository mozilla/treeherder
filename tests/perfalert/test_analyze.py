import os

import pytest

from tests.sampledata import SampleData
from treeherder.perfalert.perfalert import (
    RevisionDatum,
    analyze,
    calc_t,
    default_weights,
    detect_changes,
    linear_weights,
)


@pytest.mark.parametrize(
    ("revision_data", "weight_fn", "expected"),
    [
        # common-cases (one revision, one value)
        ([], default_weights, {"avg": 0.0, "n": 0, "variance": 0.0}),
        ([[3.0]], default_weights, {"avg": 3.0, "n": 1, "variance": 0.0}),
        (
            [[1.0], [2.0], [3.0], [4.0]],
            default_weights,
            {"avg": 2.5, "n": 4, "variance": 5.0 / 3.0},
        ),
        ([[1.0], [2.0], [3.0], [4.0]], linear_weights, {"avg": 2.0, "n": 4, "variance": 2.0}),
        # trickier cases (multiple data per revision)
        ([[1.0, 3.0], [4.0, 4.0]], default_weights, {"avg": 3.0, "n": 4, "variance": 2.0}),
        ([[2.0, 3.0], [4.0, 4.0]], linear_weights, {"avg": 3.0, "n": 4, "variance": 1.0}),
    ],
)
def test_analyze_fn(revision_data, weight_fn, expected):
    data = [
        RevisionDatum(i, i, values) for (i, values) in zip(range(len(revision_data)), revision_data)
    ]
    assert analyze(data, weight_fn) == expected


def test_weights():
    assert [default_weights(i, 5) for i in range(5)] == [1.0, 1.0, 1.0, 1.0, 1.0]
    assert [linear_weights(i, 5) for i in range(5)] == [1.0, 0.8, 0.6, 0.4, 0.2]


@pytest.mark.parametrize(
    ("old_data", "new_data", "expected"),
    [
        ([0.0, 0.0], [1.0, 2.0], 3.0),
        ([0.0, 0.0], [0.0, 0.0], 0.0),
        ([0.0, 0.0], [1.0, 1.0], float('inf')),
    ],
)
def test_calc_t(old_data, new_data, expected):
    assert calc_t([RevisionDatum(0, 0, old_data)], [RevisionDatum(1, 1, new_data)]) == expected


def test_detect_changes():
    data = []

    times = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    values = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]
    for (t, v) in zip(times, values):
        data.append(RevisionDatum(t, t, [float(v)]))

    result = [
        (d.push_timestamp, d.change_detected)
        for d in detect_changes(
            data, min_back_window=5, max_back_window=5, fore_window=5, t_threshold=2
        )
    ]
    assert result == [
        (0, False),
        (1, False),
        (2, False),
        (3, False),
        (4, False),
        (5, False),
        (6, False),
        (7, False),
        (8, True),
        (9, False),
        (10, False),
        (11, False),
        (12, False),
        (13, False),
        (14, False),
        (15, False),
    ]


def test_detect_changes_few_revisions_many_values():
    '''
    Tests that we correctly detect a regression with
    a small number of revisions but a large number of values
    '''
    data = [
        RevisionDatum(0, 0, [0] * 50 + [1] * 30),
        RevisionDatum(1, 1, [0] * 10 + [1] * 30),
        RevisionDatum(1, 1, [0] * 10 + [1] * 30),
    ]
    result = [
        (d.push_timestamp, d.change_detected)
        for d in detect_changes(
            data, min_back_window=5, max_back_window=10, fore_window=5, t_threshold=2
        )
    ]

    assert result == [(0, False), (1, True), (1, False)]


@pytest.mark.parametrize(
    ("filename", "expected_timestamps"),
    [
        ('runs1.json', [1365019665]),
        ('runs2.json', [1357704596, 1358971894, 1365014104]),
        ('runs3.json', [1335293827, 1338839958]),
        ('runs4.json', [1364922838]),
        ('runs5.json', []),
        ('a11y.json', [1366197637, 1367799757]),
        ('tp5rss.json', [1372846906, 1373413365, 1373424974]),
    ],
)
def test_detect_changes_historical_data(filename, expected_timestamps):
    """Parse JSON produced by http://graphs.mozilla.org/api/test/runs"""
    # Configuration for Analyzer
    FORE_WINDOW = 12
    MIN_BACK_WINDOW = 12
    MAX_BACK_WINDOW = 24
    THRESHOLD = 7

    payload = SampleData.get_perf_data(os.path.join('graphs', filename))
    runs = payload['test_runs']
    data = [RevisionDatum(r[2], r[2], [r[3]]) for r in runs]

    results = detect_changes(
        data,
        min_back_window=MIN_BACK_WINDOW,
        max_back_window=MAX_BACK_WINDOW,
        fore_window=FORE_WINDOW,
        t_threshold=THRESHOLD,
    )
    regression_timestamps = [d.push_timestamp for d in results if d.change_detected]
    assert regression_timestamps == expected_timestamps
