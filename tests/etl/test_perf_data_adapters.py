import json
from django.test import TestCase

from tests.sampledata import SampleData
from treeherder.etl.perf_data_adapters import TalosDataAdapter
from treeherder.model.models import (MachinePlatform, Option,
                                     OptionCollection, Repository,
                                     RepositoryGroup)
from treeherder.perf.models import (PerformanceSignature, PerformanceDatum)


class TalosDataAdapterTest(TestCase):

    OPTION_HASH = "my_option_hash"
    REPO_NAME = 'mozilla-central'
    MACHINE_PLATFORM = "win7"

    def setUp(self):
        repo_group = RepositoryGroup.objects.create(name='mygroup')
        repo_args = {
            "dvcs_type": "hg",
            "name": self.REPO_NAME,
            "url": "https://hg.mozilla.org/mozilla-central",
            "active_status": "active",
            "codebase": "gecko",
            "repository_group": repo_group,
            "description": ""
        }
        Repository.objects.create(**repo_args)
        option, _ = Option.objects.get_or_create(name='asan')
        OptionCollection.objects.get_or_create(
                    option_collection_hash=self.OPTION_HASH,
                    option=option)
        MachinePlatform.objects.get_or_create(
            os_name="win",
            platform=self.MACHINE_PLATFORM,
            architecture="x86",
            defaults={
                'active_status': "active"
            })

    def test_adapt_and_load(self):
        talos_perf_data = SampleData.get_talos_perf_data()
        for talos_datum in talos_perf_data:
            # delete any previously-created perf objects
            # FIXME: because of https://bugzilla.mozilla.org/show_bug.cgi?id=1133273
            # this can be really slow if we have a dev database with lots of
            # performance data in it (if the test succeeds, the transaction
            # will be rolled back so at least it won't pollute the production
            # database)
            PerformanceSignature.objects.all().delete()
            PerformanceDatum.objects.all().delete()

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
                "option_collection_hash": self.OPTION_HASH,
                "machine_platform": self.MACHINE_PLATFORM,
                "property1": "value1",
                "property2": "value2",
                "property3": "value3"
            }

            # Mimic production environment, the blobs are serialized
            # when the web service receives them
            datum['blob'] = json.dumps({'talos_data': [datum['blob']]})
            tda = TalosDataAdapter()
            tda.adapt_and_load(self.REPO_NAME, reference_data, job_data, datum)

            # base: subtests + one extra result for the summary series
            expected_result_count = len(talos_datum["results"]) + 1

            # we create one performance series per counter
            if 'talos_counters' in talos_datum:
                expected_result_count += len(talos_datum["talos_counters"])

            # result count == number of signatures
            self.assertEqual(expected_result_count,
                             PerformanceSignature.objects.all().count())

            # verify that we have signatures for the subtests
            for (testname, results) in talos_datum["results"].iteritems():
                signature = PerformanceSignature.objects.get(test=testname)
                datum = PerformanceDatum.objects.get(signature=signature)
                if talos_datum.get('summary'):
                    # if we have a summary, ensure the subtest summary values made
                    # it in
                    for measure in ['min', 'max', 'std', 'mean', 'median']:
                        self.assertEqual(
                            round(talos_datum['summary']['subtests'][testname][measure], 2),
                            datum.datum[measure])
                else:
                    # this is an old style talos blob without a summary. these are going
                    # away, so I'm not going to bother testing the correctness. however
                    # let's at least verify that some values are being generated here
                    for measure in ['min', 'max', 'std', 'mean', 'median']:
                        self.assertTrue(datum.datum[measure])

            # if we have counters, verify that the series for them is as expected
            for (counter, results) in talos_datum.get('talos_counters',
                                                      {}).iteritems():
                signature = PerformanceSignature.objects.get(test=counter)
                datum = PerformanceDatum.objects.get(signature=signature)
                for measure in ['max', 'mean']:
                    self.assertEqual(round(float(results[measure]), 2),
                                     datum.datum[measure])

            # we should be left with just the summary series
            signature = PerformanceSignature.objects.get(
                test='',
                suite=talos_datum['testrun']['suite'])
            datum = PerformanceDatum.objects.get(signature=signature)
            if talos_datum.get('summary'):
                self.assertEqual(round(talos_datum['summary']['suite'], 2),
                                 datum.datum['geomean'])
            else:
                # old style talos blob without summary. again, going away,
                # but let's at least test that we have the 'geomean' value
                # generated
                self.assertEqual(type(datum.datum['geomean']), float)
