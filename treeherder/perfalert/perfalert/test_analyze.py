# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
import unittest
import json
import os
import sys

from analyze import *

class TestAnalyze(unittest.TestCase):
    def test_analyze(self):
        self.assertEqual(analyze([]),
            {"avg": 0.0, "n": 0, "variance": 0.0})
        self.assertEqual(analyze([3.0]),
            {"avg": 3.0, "n": 1, "variance": 0.0})
        self.assertEqual(analyze([1.0, 2.0, 3.0, 4.0]),
            {"avg": 2.5, "n": 4, "variance": 5.0/3.0})

    def test_calc_t(self):
        self.assertEqual(calc_t([0.0, 0.0], [1.0, 2.0]), 3.0)
        self.assertEqual(calc_t([0.0, 0.0], [0.0, 0.0]), 0.0)
        self.assertEqual(calc_t([0.0, 0.0], [1.0, 1.0]), float('inf'))

class TestTalosAnalyzer(unittest.TestCase):
    def get_data(self):
        times  = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        values = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1,  1,  1,  1,  1,  1,  1]
        return [PerfDatum(t, t, t, float(v), t, t) for t, v in zip(times, values)]

    def test_analyze_t(self):
        a = TalosAnalyzer()

        data = self.get_data()
        a.addData(data)

        result = [(d.time, d.state) for d in a.analyze_t(5, 5, 2, 15, 5)]
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
        self.check_json('runs2.json', [1358971894, 1365014104])
        self.check_json('runs3.json', [1335293827, 1338839958])
        self.check_json('runs4.json', [1364922838])
        self.check_json('runs5.json', [])

    def check_json(self, filename, expected_timestamps):
        """Parse JSON produced by http://graphs.mozilla.org/api/test/runs"""
        # Configuration for TalosAnalyzer
        FORE_WINDOW = 12
        BACK_WINDOW = 12
        THRESHOLD = 9
        MACHINE_THRESHOLD = 15
        MACHINE_HISTORY_SIZE = 5

        inputfile = open(os.path.join('test_data', filename))
        payload = json.load(inputfile)
        runs = payload['test_runs']
        data = [PerfDatum(r[0], r[6], r[2], r[3], r[1][1], r[2], r[1][2]) for r in runs]

        a = TalosAnalyzer()
        a.addData(data)
        results = a.analyze_t(BACK_WINDOW, FORE_WINDOW, THRESHOLD,
                MACHINE_THRESHOLD, MACHINE_HISTORY_SIZE)
        regression_timestamps = [d.timestamp for d in results if d.state == 'regression']
        self.assertEqual(regression_timestamps, expected_timestamps)

if __name__ == '__main__':
    unittest.main()
