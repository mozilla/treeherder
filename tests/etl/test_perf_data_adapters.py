import copy
import json

from django.test import TestCase

from tests.sampledata import SampleData
from treeherder.etl.perf import load_perf_artifacts, load_talos_artifacts
from treeherder.model.models import (MachinePlatform, Option,
                                     OptionCollection, Repository,
                                     RepositoryGroup)
from treeherder.perf.models import (PerformanceFramework, PerformanceSignature,
                                    PerformanceDatum)


class PerfDataAdapterTest(TestCase):

    OPTION_HASH = "my_option_hash"
    REPO_NAME = 'mozilla-central'
    MACHINE_PLATFORM = "win7"
    JOB_GUID = "oqiwy0q847365qiu"

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
        self.option_collection, _ = OptionCollection.objects.get_or_create(
            option_collection_hash=self.OPTION_HASH,
            option=option)
        self.platform, _ = MachinePlatform.objects.get_or_create(
            os_name="win",
            platform=self.MACHINE_PLATFORM,
            architecture="x86",
            defaults={
                'active_status': "active"
            })

    def _get_job_and_reference_data(self):
        job_data = {
            self.JOB_GUID: {
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

        return (job_data, reference_data)

    def _verify_signature_datum(self, framework_name, suitename, testname,
                                value):

        signature = PerformanceSignature.objects.get(
            suite=suitename,
            test=testname)
        self.assertEqual(str(signature.framework), str(framework_name))
        self.assertEqual(str(signature.option_collection),
                         str(self.option_collection))
        self.assertEqual(str(signature.platform),
                         str(self.platform))

        datum = PerformanceDatum.objects.get(signature=signature)
        self.assertEqual(datum.value, value)

    def test_load_generic_data(self):
        framework_name = "cheezburger"

        PerformanceDatum.objects.all().delete()
        PerformanceSignature.objects.all().delete()
        PerformanceFramework.objects.all().delete()
        PerformanceFramework.objects.get_or_create(name=framework_name)

        (job_data, reference_data) = self._get_job_and_reference_data()
        datum = {
            "job_guid": self.JOB_GUID,
            "name": "test",
            "type": "test",
            "blob": {
                "framework": {"name": framework_name},
                "suites": [
                    {
                        "name": "cheezburger metrics",
                        "value": 10.0,
                        "subtests": [
                            {
                                "name": "test1",
                                "value": 20.0
                            },
                            {
                                "name": "test2",
                                "value": 30.0
                            }
                        ]
                    }
                ]
            }
        }

        # the perf data adapter expects unserialized performance data
        submit_datum = copy.copy(datum)
        submit_datum['blob'] = json.dumps(submit_datum['blob'])

        load_perf_artifacts(self.REPO_NAME, reference_data, job_data,
                            submit_datum)
        self.assertEqual(3, PerformanceSignature.objects.all().count())
        self.assertEqual(1, PerformanceFramework.objects.all().count())
        framework = PerformanceFramework.objects.all()[0]
        self.assertEqual(framework_name, framework.name)

        perf_datum = datum['blob']

        # verify summary, then subtests
        self._verify_signature_datum(perf_datum['framework']['name'],
                                     perf_datum['suites'][0]['name'], '', 10.0)
        for subtest in perf_datum['suites'][0]['subtests']:
            self._verify_signature_datum(perf_datum['framework']['name'],
                                         perf_datum['suites'][0]['name'],
                                         subtest['name'], subtest['value'])

    def test_load_talos_data(self):

        PerformanceFramework.objects.get_or_create(name='talos')

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

            (job_data, reference_data) = self._get_job_and_reference_data()

            datum = {
                "job_guid": self.JOB_GUID,
                "name": "test",
                "type": "test",
                "blob": talos_datum
            }

            # Mimic production environment, the blobs are serialized
            # when the web service receives them
            datum['blob'] = json.dumps({'talos_data': [datum['blob']]})
            load_talos_artifacts(self.REPO_NAME, reference_data, job_data, datum)

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
                    self.assertEqual(
                        round(talos_datum['summary']['subtests'][testname]['filtered'], 2),
                        datum.value)
                else:
                    # this is an old style talos blob without a summary. these are going
                    # away, so I'm not going to bother testing the correctness. however
                    # let's at least verify that some values are being generated here
                    self.assertTrue(datum.value)

            # if we have counters, verify that the series for them is as expected
            for (counter, results) in talos_datum.get('talos_counters',
                                                      {}).iteritems():
                signature = PerformanceSignature.objects.get(test=counter)
                datum = PerformanceDatum.objects.get(signature=signature)
                self.assertEqual(round(float(results['mean']), 2),
                                 datum.value)

            # we should be left with just the summary series
            signature = PerformanceSignature.objects.get(
                test='',
                suite=talos_datum['testrun']['suite'])
            datum = PerformanceDatum.objects.get(signature=signature)
            if talos_datum.get('summary'):
                self.assertEqual(round(talos_datum['summary']['suite'], 2),
                                 datum.value)
            else:
                # old style talos blob without summary. again, going away,
                # but let's at least test that we have the value
                self.assertTrue(datum.value)
