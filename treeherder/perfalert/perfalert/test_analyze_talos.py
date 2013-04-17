# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
import unittest

from analyze import PerfDatum
from analyze_talos import *
from ConfigParser import RawConfigParser
from time import time

TEST_CONFIG = """
base_hg_url = http://example.com
"""

class TestAnalysisRunner(unittest.TestCase):
    def get_config(self):
        options, args = parse_options(['--start-time', '0'])
        config = get_config(options)
        config.set('main', 'fore_window', '5')
        config.set('main', 'back_window', '5')
        config.set('main', 'threshold', '9')
        config.set('main', 'percentage_threshold', '9')
        config.set('main', 'machine_threshold', '9')
        config.set('main', 'machine_history_size', '0')
        return options, config

    def get_data(self):
        return [
            (PerfDatum(0, 0, time() + 0, 0.0, 0, 0), 'good'),
            (PerfDatum(1, 1, time() + 1, 0.0, 1, 1), 'good'),
            (PerfDatum(2, 2, time() + 2, 0.0, 2, 2), 'good'),
            (PerfDatum(3, 3, time() + 3, 0.0, 3, 3), 'good'),
            (PerfDatum(4, 4, time() + 4, 1.0, 4, 4), 'regression'),
            (PerfDatum(5, 5, time() + 5, 1.0, 5, 5), 'good'),
            (PerfDatum(6, 6, time() + 6, 1.0, 6, 6), 'good'),
            (PerfDatum(7, 7, time() + 7, 1.0, 7, 7), 'good'),
        ]

    def test_processSeries(self):
        options, config = self.get_config()
        runner = AnalysisRunner(options, config)

        data = self.get_data()
        results = runner.processSeries(data, [])
        self.assertEqual(len(results), 8)

        skipped = filter(lambda (d, state, skip, last_good): skip, results)
        self.assertEqual(len(skipped), 0)

        self.assertEqual(results[3], (data[3][0], 'good', False, data[3][0]))
        self.assertEqual(results[4], (data[4][0], 'regression', False, data[3][0]))
        self.assertEqual(results[5], (data[5][0], 'good', False, data[5][0]))


if __name__ == '__main__':
    unittest.main()
