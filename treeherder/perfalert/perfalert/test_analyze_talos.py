# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
import unittest

from analyze import PerfDatum
from analyze_talos import *
from ConfigParser import RawConfigParser
from time import time

class TestAnalysisRunner(unittest.TestCase):
    def create_runner(self):
        options, args = parse_options(['--start-time', '0'])
        options.config = 'analysis.cfg.template'
        config = get_config(options)
        return AnalysisRunner(options, config)

    def get_data(self):
        return [
            PerfDatum(0, 0, time() + 0, 0.0, 0, 0, state='good'),
            PerfDatum(1, 1, time() + 1, 0.0, 1, 1, state='good'),
            PerfDatum(2, 2, time() + 2, 0.0, 2, 2, state='good'),
            PerfDatum(3, 3, time() + 3, 0.0, 3, 3, state='good'),
            PerfDatum(4, 4, time() + 4, 1.0, 4, 4, state='regression'),
            PerfDatum(5, 5, time() + 5, 1.0, 5, 5, state='good'),
            PerfDatum(6, 6, time() + 6, 1.0, 6, 6, state='good'),
            PerfDatum(7, 7, time() + 7, 1.0, 7, 7, state='good'),
        ]

    def test_processSeries(self):
        runner = self.create_runner()

        data = self.get_data()
        results = runner.processSeries(data, [])
        self.assertEqual(len(results), 8)

        skipped = filter(lambda (d, skip, last_good): skip, results)
        self.assertEqual(len(skipped), 0)

        self.assertEqual(results[3], (data[3], False, data[3]))
        self.assertEqual(results[4], (data[4], False, data[3]))
        self.assertEqual(results[5], (data[5], False, data[5]))

    def test_isTestReversed(self):
        runner = self.create_runner()

        self.assertTrue(runner.isTestReversed('x Dromaeo'))
        self.assertTrue(runner.isTestReversed('Dromaeo x'))
        self.assertTrue(runner.isTestReversed('V8 version 7'))
        self.assertTrue(runner.isTestReversed('V8 version 7.1'))

        self.assertFalse(runner.isTestReversed('V8'))
        self.assertFalse(runner.isTestReversed('some other test'))

    def test_ignorePercentageForTest(self):
        runner = self.create_runner()

        self.assertTrue(runner.ignorePercentageForTest('LibXUL Memory during link'))
        self.assertFalse(runner.ignorePercentageForTest('LibXUL Memory'))

        self.assertFalse(runner.ignorePercentageForTest('LibXUL something else'))
        self.assertFalse(runner.ignorePercentageForTest('V8'))

    def test_shouldSendWarning(self):
        runner = self.create_runner()
        d = PerfDatum(0, 0, time() + 0, 0.0, 0, 0)
        d.historical_stats = { 'avg': 100.0 }

        # 1% increase
        d.forward_stats = { 'avg': 101.0 }
        self.assertFalse(runner.shouldSendWarning(d, 'some test'))

        # 10% increase
        d.forward_stats = { 'avg': 110.0 }
        self.assertTrue(runner.shouldSendWarning(d, 'some test'))

        # 1% decrease
        d.forward_stats = { 'avg': 99.0 }
        self.assertFalse(runner.shouldSendWarning(d, 'some test'))

        # 10% decrease
        d.forward_stats = { 'avg': 90.0 }
        self.assertTrue(runner.shouldSendWarning(d, 'some test'))

        # 1% increase, ignore percentage
        d.forward_stats = { 'avg': 101.0 }
        self.assertTrue(runner.shouldSendWarning(d, 'LibXUL Memory during link'))


if __name__ == '__main__':
    unittest.main()
