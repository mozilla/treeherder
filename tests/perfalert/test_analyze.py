import os
import unittest

from tests.sampledata import SampleData
from treeherder.perfalert import *


class TestAnalyze(unittest.TestCase):

    def test_analyze(self):
        self.assertEqual(analyze([]),
                         {"avg": 0.0, "n": 0, "variance": 0.0})
        self.assertEqual(analyze([3.0]),
                         {"avg": 3.0, "n": 1, "variance": 0.0})
        self.assertEqual(analyze([1.0, 2.0, 3.0, 4.0]),
                         {"avg": 2.5, "n": 4, "variance": 5.0/3.0})
        self.assertEqual(analyze([1.0, 2.0, 3.0, 4.0], linear_weights),
                         {"avg": 2.0, "n": 4, "variance": 2.0})

    def test_weights(self):
        self.assertEqual([default_weights(i, 5) for i in range(5)],
                         [1.0, 1.0, 1.0, 1.0, 1.0])
        self.assertEqual([linear_weights(i, 5) for i in range(5)],
                         [1.0, 0.8, 0.6, 0.4, 0.2])

    def test_calc_t(self):
        self.assertEqual(calc_t([0.0, 0.0], [1.0, 2.0]), 3.0)
        self.assertEqual(calc_t([0.0, 0.0], [0.0, 0.0]), 0.0)
        self.assertEqual(calc_t([0.0, 0.0], [1.0, 1.0]), float('inf'))


class TestAnalyzer(unittest.TestCase):

    def get_data(self):
        times = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        values = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1,  1,  1,  1,  1,  1,  1]
        return [PerfDatum(t, float(v)) for t, v in zip(times, values)]

    def test_analyze_t(self):
        a = Analyzer()

        data = self.get_data()
        a.addData(data)
        result = [(d.push_timestamp, d.state) for d in
                  a.analyze_t(back_window=5, fore_window=5, t_threshold=2,
                              machine_threshold=15, machine_history_size=5)]
        self.assertEqual(result, [
            (1, 'good'),
            (2, 'good'),
            (3, 'good'),
            (4, 'good'),
            (5, 'good'),
            (6, 'good'),
            (7, 'good'),
            (8, 'regression'),
            (9, 'good'),
            (10, 'good')])

    def test_json_files(self):
        self.check_json('runs1.json', [1365019665])
        self.check_json('runs2.json', [1357692289, 1358971894, 1365014104])
        self.check_json('runs3.json', [1335293827, 1338839958])
        self.check_json('runs4.json', [1364922838])
        self.check_json('runs5.json', [])
        self.check_json('a11y.json', [1366197637, 1367799757])
        self.check_json('tp5rss.json', [1373413365, 1373424974])

    def check_json(self, filename, expected_timestamps):
        """Parse JSON produced by http://graphs.mozilla.org/api/test/runs"""
        # Configuration for Analyzer
        FORE_WINDOW = 12
        BACK_WINDOW = 12
        THRESHOLD = 7
        MACHINE_THRESHOLD = 15
        MACHINE_HISTORY_SIZE = 5

        payload = SampleData.get_perf_data(os.path.join('graphs', filename))
        runs = payload['test_runs']
        data = [PerfDatum(r[2], r[3], testrun_id=r[0], machine_id=r[6],
                          testrun_timestamp=r[2], buildid=r[1][1],
                          revision=r[1][2]) for r in runs]

        a = Analyzer()
        a.addData(data)
        results = a.analyze_t(BACK_WINDOW, FORE_WINDOW, THRESHOLD,
                              MACHINE_THRESHOLD, MACHINE_HISTORY_SIZE)
        regression_timestamps = [d.testrun_timestamp for d in results if
                                 d.state == 'regression']
        self.assertEqual(regression_timestamps, expected_timestamps)

if __name__ == '__main__':
    unittest.main()
