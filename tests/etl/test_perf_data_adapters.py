import copy
import datetime
import json

from django.test import TestCase

from tests.sampledata import SampleData
from treeherder.etl.perf import (load_perf_artifacts,
                                 load_talos_artifacts)
from treeherder.model.models import (MachinePlatform,
                                     Option,
                                     OptionCollection,
                                     Repository,
                                     RepositoryGroup)
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)


class PerfDataAdapterTest(TestCase):

    OPTION_HASH = "my_option_hash"
    REPO_NAME = 'mozilla-central'
    MACHINE_PLATFORM = "win7"
    JOB_GUID = "oqiwy0q847365qiu"
    PUSH_TIMESTAMP = 1402692388

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

    def _get_job_and_reference_data(self, result_set_id=1,
                                    push_timestamp=PUSH_TIMESTAMP):
        job_data = {
            self.JOB_GUID: {
                "id": 1,
                "result_set_id": result_set_id,
                "push_timestamp": push_timestamp
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
                                lower_is_better, value, push_timestamp):
        repository = Repository.objects.get(name=self.REPO_NAME)
        signature = PerformanceSignature.objects.get(
            suite=suitename,
            test=testname)
        self.assertEqual(str(signature.framework), str(framework_name))
        self.assertEqual(str(signature.option_collection),
                         str(self.option_collection))
        self.assertEqual(str(signature.platform),
                         str(self.platform))
        self.assertEqual(signature.last_updated, push_timestamp)
        self.assertEqual(signature.repository, repository)
        self.assertEqual(signature.lower_is_better, lower_is_better)

        datum = PerformanceDatum.objects.get(signature=signature)
        self.assertEqual(datum.value, value)
        self.assertEqual(datum.push_timestamp, push_timestamp)

    def _create_submit_datum(self, datum):
        # the perf data adapter expects unserialized performance data
        submit_datum = copy.copy(datum)
        submit_datum['blob'] = json.dumps({
            'performance_data': submit_datum['blob']
        })
        return submit_datum

    def test_load_generic_data(self):
        framework_name = "cheezburger"
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
                        "lowerIsBetter": True,
                        "value": 10.0,
                        "subtests": [
                            {
                                "name": "test1",
                                "value": 20.0,
                                "lowerIsBetter": True
                            },
                            {
                                "name": "test2",
                                "value": 30.0,
                                "lowerIsBetter": False
                            },
                            {
                                "name": "test3",
                                "value": 40.0
                            }
                        ]
                    }
                ]
            }
        }

        submit_datum = self._create_submit_datum(datum)
        load_perf_artifacts(self.REPO_NAME, reference_data, job_data,
                            submit_datum)
        self.assertEqual(4, PerformanceSignature.objects.all().count())
        self.assertEqual(1, PerformanceFramework.objects.all().count())
        framework = PerformanceFramework.objects.all()[0]
        self.assertEqual(framework_name, framework.name)

        perf_datum = datum['blob']

        # verify summary, then subtests
        self._verify_signature_datum(perf_datum['framework']['name'],
                                     perf_datum['suites'][0]['name'],
                                     '',
                                     perf_datum['suites'][0]['lowerIsBetter'],
                                     perf_datum['suites'][0]['value'],
                                     datetime.datetime.fromtimestamp(
                                         self.PUSH_TIMESTAMP))
        for subtest in perf_datum['suites'][0]['subtests']:
            self._verify_signature_datum(perf_datum['framework']['name'],
                                         perf_datum['suites'][0]['name'],
                                         subtest['name'],
                                         subtest.get('lowerIsBetter', True),
                                         subtest['value'],
                                         datetime.datetime.fromtimestamp(
                                             self.PUSH_TIMESTAMP))

        # send another datum, a little later, verify that signature's
        # `last_updated` is changed accordingly
        job_data[self.JOB_GUID]['push_timestamp'] += 1
        load_perf_artifacts(self.REPO_NAME, reference_data, job_data,
                            submit_datum)
        signature = PerformanceSignature.objects.get(
            suite=perf_datum['suites'][0]['name'],
            test=perf_datum['suites'][0]['subtests'][0]['name'])
        self.assertEqual(signature.last_updated,
                         datetime.datetime.fromtimestamp(
                             self.PUSH_TIMESTAMP + 1))

    def test_alert_generation(self):
        framework_name = "cheezburger"
        PerformanceFramework.objects.get_or_create(name=framework_name)

        for (i, value) in zip(range(30), [1]*15 + [2]*15):
            (job_data, reference_data) = self._get_job_and_reference_data(
                result_set_id=i, push_timestamp=i)
            datum = {
                "job_guid": self.JOB_GUID,
                "name": "test",
                "type": "test",
                "blob": {
                    "framework": {"name": framework_name},
                    "suites": [
                        {
                            "name": "cheezburger metrics",
                            "subtests": [
                                {
                                    "name": "test1",
                                    "value": value
                                }
                            ]
                        }
                    ]
                }
            }
            load_perf_artifacts(self.REPO_NAME, reference_data, job_data,
                                self._create_submit_datum(datum))

        # validate that a performance alert was generated
        self.assertEqual(1, PerformanceAlert.objects.all().count())
        self.assertEqual(1, PerformanceAlertSummary.objects.all().count())

        summary = PerformanceAlertSummary.objects.get(id=1)
        self.assertEqual(summary.result_set_id, 15)
        self.assertEqual(summary.prev_result_set_id, 14)

        alert = PerformanceAlert.objects.get(id=1)
        self.assertEqual(alert.is_regression, True)
        self.assertEqual(alert.amount_abs, 1)
        self.assertEqual(alert.amount_pct, 100)

    def test_load_talos_data(self):

        PerformanceFramework.objects.get_or_create(name='talos')

        talos_perf_data = SampleData.get_talos_perf_data()
        for talos_datum in talos_perf_data:
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
                    # it in and that we ingested lowerIsBetter ok (if it was there)
                    subtest = talos_datum['summary']['subtests'][testname]
                    self.assertEqual(
                        round(subtest['filtered'], 2), datum.value)
                    self.assertEqual(signature.lower_is_better,
                                     subtest.get('lowerIsBetter', True))
                else:
                    # this is an old style talos blob without a summary. these are going
                    # away, so I'm not going to bother testing the correctness. however
                    # let's at least verify that some values are being generated here
                    self.assertTrue(datum.value)
                self.assertEqual(datum.push_timestamp,
                                 datetime.datetime.fromtimestamp(
                                     self.PUSH_TIMESTAMP))

            # if we have counters, verify that the series for them is as expected
            for (counter, results) in talos_datum.get('talos_counters',
                                                      {}).iteritems():
                signature = PerformanceSignature.objects.get(test=counter)
                datum = PerformanceDatum.objects.get(signature=signature)
                self.assertEqual(round(float(results['mean']), 2),
                                 datum.value)
                self.assertEqual(datum.push_timestamp,
                                 datetime.datetime.fromtimestamp(
                                     self.PUSH_TIMESTAMP))

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
            self.assertEqual(datum.push_timestamp,
                             datetime.datetime.fromtimestamp(
                                 self.PUSH_TIMESTAMP))

            # delete perf objects for next iteration
            PerformanceSignature.objects.all().delete()
            PerformanceDatum.objects.all().delete()
