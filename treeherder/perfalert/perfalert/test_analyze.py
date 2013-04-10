# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
import unittest
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

        result = [(d.time, state) for d, state in a.analyze_t(5, 5, 2, 15, 5)]
        self.assertEqual(result, [
            (0, 'good'),
            (1, 'good'),
            (2, 'good'),
            (3, 'good'),
            (4, 'good'),
            (5, 'good'),
            (6, 'regression'),
            (7, 'regression'),
            (8, 'regression'),
            (9, 'regression'),
            (10, 'regression'),
            (11, 'good')])

if __name__ == '__main__':
    unittest.main()
