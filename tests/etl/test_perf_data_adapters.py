import copy
import json
import unittest

from tests.sampledata import SampleData
from treeherder.etl.perf_data_adapters import TalosDataAdapter


class TalosDataAdapterTest(unittest.TestCase):

    def test_adapt_and_load(self):

        talos_perf_data = SampleData.get_talos_perf_data()

        for talos_datum in talos_perf_data:

            datum = {
                "job_guid": 'oqiwy0q847365qiu',
                "name": "test",
                "type": "test",
                "blob": talos_datum
            }

            job_data = {
                "oqiwy0q847365qiu": {
                    "id": 1,
                    "result_set_id": 1,
                    "push_timestamp": 1402692388
                }
            }

            reference_data = {
                "property1": "value1",
                "property2": "value2",
                "property3": "value3"
            }

            # Mimic production environment, the blobs are serialized
            # when the web service receives them
            datum['blob'] = json.dumps({'talos_data': [datum['blob']]})
            tda = TalosDataAdapter()
            tda.adapt_and_load(reference_data, job_data, datum)

            # base: subtests + one extra result for the summary series
            expected_result_count = len(talos_datum["results"]) + 1

            # we create one performance series per counter
            if 'talos_counters' in talos_datum:
                expected_result_count += len(talos_datum["talos_counters"])

            # result count == number of signatures
            self.assertEqual(expected_result_count, len(tda.signatures.keys()))

            # verify that we have signatures for the subtests
            signature_placeholders = copy.copy(
                tda.signature_property_placeholders)
            for (testname, results) in talos_datum["results"].iteritems():
                signature_placeholder = filter(
                    lambda p: p[2] == testname, signature_placeholders)
                self.assertEqual(len(signature_placeholder), 1)
                signature_hash = signature_placeholder[0][0]
                perfdata = tda.signatures[signature_hash][0]
                if talos_datum.get('summary'):
                    # if we have a summary, ensure the subtest summary values made
                    # it in
                    for measure in ['min', 'max', 'std', 'mean', 'median']:
                        self.assertEqual(
                            round(talos_datum['summary']['subtests'][testname][measure], 2),
                            perfdata[measure])
                else:
                    # this is an old style talos blob without a summary. these are going
                    # away, so I'm not going to bother testing the correctness. however
                    # let's at least verify that some values are being generated here
                    for measure in ['min', 'max', 'std', 'mean', 'median']:
                        self.assertTrue(perfdata[measure])

                # filter out this signature from data to process
                signature_placeholders = filter(
                    lambda p: p[0] != signature_hash, signature_placeholders)

            # if we have counters, verify that the series for them is as expected
            for (counter, results) in talos_datum.get('talos_counters',
                                                      {}).iteritems():
                signature_placeholder = filter(
                    lambda p: p[2] == counter, signature_placeholders)
                self.assertEqual(len(signature_placeholder), 1)
                signature_hash = signature_placeholder[0][0]
                perfdata = tda.signatures[signature_hash][0]
                for measure in ['max', 'mean']:
                    self.assertEqual(round(float(results[measure]), 2),
                                     perfdata[measure])
                # filter out this signature from data to process
                signature_placeholders = filter(
                    lambda p: p[0] != signature_hash, signature_placeholders)

            # we should be left with just summary signature placeholders
            self.assertEqual(len(signature_placeholders), 2)
            perfdata = tda.signatures[signature_placeholders[0][0]][0]
            if talos_datum.get('summary'):
                self.assertEqual(round(talos_datum['summary']['suite'], 2),
                                 perfdata['geomean'])
            else:
                # old style talos blob without summary. again, going away,
                # but let's at least test that we have the 'geomean' value
                # generated
                self.assertTrue(perfdata['geomean'])
