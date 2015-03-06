# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import simplejson as json
from simplejson import encoder

from hashlib import sha1
import math

from jsonschema import validate

encoder.FLOAT_REPR = lambda o: format(o, '.2f')


class PerformanceDataAdapter(object):

    """
    Base class for translating different performance data structures into
    treeherder performance artifacts.
    """

    performance_types = set([
        'performance',
        'talos_data'
    ])

    def __init__(self):

        self.datazilla_schema = {
            "title": "Datazilla Schema",

            "type": "object",

            "properties": {
                "test_machine": {"type": "object"},
                "testrun": {"type": "object"},
                "results": {"type": "object"},
                "test_build": {"type": "object"},
                "test_aux": {"type": "object"}
            },

            "required": ["results", "test_build", "testrun", "test_machine"]
        }

        """
        name = test suite name
        type = perf_test | perf_aux

        perf_aux can have any structure
        """
        self.treeherder_perf_test_schema = {
            "title": "Treeherder Schema",

            "type": "object",

            "properties": {
                "job_guid": {"type": "string"},
                "name": {"type": "string"},
                "type": {"type": "string"},
                "blob": {
                    "type": "object",
                    "properties": {
                        "date": {"type": "integer"},  # time test was run
                        "series_properties": {"type": "object"},
                        "series_signature": {"type": "string"},
                        "testsuite": {"type": "string"},
                        "test": {"type": "string"},
                        "replicates": {"type": "array"},
                        "performance_series": {"type": "object"},
                        "metadata": {"type": "object"}  # (holds 'options' from talos data & various auxiliary data including 'test_aux', 'talox_aux', 'results_aux', and 'results_xperf')
                    },
                    "required": [
                        "date", "series_signature", "testsuite",
                    ]
                }
            },
            "required": ["blob", "job_guid", "name", "type"]
        }

    @staticmethod
    def _round(num):
        # Use a precision of .2f for all numbers stored
        # to insure we don't have floats with giant mantissa's
        # that inflate the size of the stored data structure
        return round(num, 2)

    @staticmethod
    def _calculate_summary_data(job_id, result_set_id, push_timestamp, results):
        values = []
        for test in results:
            values += results[test]

        if values:
            geomean = math.exp(sum(map(lambda v: math.log(v+1),
                                       values))/len(values))-1
        else:
            geomean = 0.0

        return {
            "job_id": job_id,
            "result_set_id": result_set_id,
            "push_timestamp": push_timestamp,
            "geomean": PerformanceDataAdapter._round(geomean)
        }

    @staticmethod
    def _calculate_test_data(job_id, result_set_id, push_timestamp,
                             replicates):
        replicates.sort()
        r = replicates
        r_len = len(replicates)

        series_data = {
            "job_id": job_id,
            "result_set_id": result_set_id,
            "push_timestamp": push_timestamp,
            "total_replicates": r_len,
            "min": PerformanceDataAdapter._round(min(r)),
            "max": PerformanceDataAdapter._round(max(r)),
            "mean": 0,
            "std": 0,
            "median": 0
        }

        if r_len > 0:
            def avg(s):
                return float(sum(r)) / r_len

            mean = float(sum(r))/r_len
            variance = map(lambda x: (x - mean)**2, replicates)

            series_data["mean"] = PerformanceDataAdapter._round(mean)
            series_data["std"] = PerformanceDataAdapter._round(
                math.sqrt(avg(variance)))

            if len(r) % 2 == 1:
                series_data["median"] = PerformanceDataAdapter._round(
                    r[int(math.floor(len(r)/2))])
            else:
                series_data["median"] = PerformanceDataAdapter._round(
                    avg([r[(len(r)/2) - 1], r[len(r)/2]]))

        return series_data

    @staticmethod
    def _get_series_signature(signature_properties):
        signature_prop_values = signature_properties.keys()
        signature_prop_values.extend(signature_properties.values())

        sha = sha1()
        sha.update(''.join(map(lambda x: str(x), sorted(signature_prop_values))))

        return sha.hexdigest()

    def _add_performance_artifact(self, job_id, series_signature,
                                  signature_properties, obj,
                                  name, testname, testdata):
        if series_signature not in self.signatures:
            self.signatures[series_signature] = []

            for signature_property in signature_properties:
                self.signature_property_placeholders.append([
                    series_signature,
                    signature_property,
                    signature_properties[signature_property],
                    series_signature,
                    signature_property,
                    signature_properties[signature_property],
                ])

        self.performance_artifact_placeholders.append([
            job_id,
            series_signature,
            name,
            testname,
            json.dumps(obj)
        ])
        self.signatures[series_signature].append(testdata)


class TalosDataAdapter(PerformanceDataAdapter):

    def __init__(self):

        super(TalosDataAdapter, self).__init__()

        self.adapted_data = []

        self.signatures = {}
        self.performance_artifact_placeholders = []
        self.signature_property_placeholders = []

    @staticmethod
    def _get_base_perf_obj(job_guid, name, type, talos_datum, series_signature,
                           signature_properties, series_data):

        # N.B. test_build information (i.e. revision) just there to ease third
        # party alert processing, since we should normally be able to get
        # it by querying the job info
        obj = {
            "job_guid": job_guid,
            "name": name,
            "type": type,
            "blob": {
                "date": talos_datum["testrun"]["date"],
                "series_signature": series_signature,
                "signature_properties": signature_properties,
                "performance_series": series_data,
                "testsuite": talos_datum["testrun"]["suite"],
                "metadata": {'test_build': talos_datum['test_build']}
            }
        }
        options = talos_datum["testrun"].get("options")
        if options:
            obj['blob']['metadata']['options'] = options

        return obj

    def adapt_and_load(self, reference_data, job_data, datum):

        # Get just the talos datazilla structure for treeherder
        target_datum = json.loads(datum['blob'])
        for talos_datum in target_datum['talos_data']:
            validate(talos_datum, self.datazilla_schema)

            _job_guid = datum["job_guid"]
            _name = datum["name"]
            _type = "performance"
            _suite = talos_datum["testrun"]["suite"]

            # data for performance series
            job_id = job_data[_job_guid]['id']
            result_set_id = job_data[_job_guid]['result_set_id']
            push_timestamp = job_data[_job_guid]['push_timestamp']

            subtest_signatures = []

            # series for all the subtests
            for _test in talos_datum["results"].keys():

                signature_properties = {
                    'suite': _suite,
                    'test': _test
                }
                signature_properties.update(reference_data)

                series_signature = self._get_series_signature(
                    signature_properties)
                subtest_signatures.append(series_signature)

                series_data = self._calculate_test_data(
                    job_id, result_set_id, push_timestamp,
                    talos_datum["results"][_test]
                )

                obj = self._get_base_perf_obj(_job_guid, _name, _type,
                                              talos_datum,
                                              series_signature,
                                              signature_properties,
                                              series_data)
                obj['test'] = _test
                obj['replicates'] = talos_datum["results"][_test]

                for key in ['test_aux', 'talos_aux', 'results_aux',
                            'results_xperf']:
                    aux_blob = talos_datum.get(key)
                    if aux_blob:
                        obj['blob']['metadata'][key] = aux_blob

                validate(obj, self.treeherder_perf_test_schema)
                self._add_performance_artifact(job_id, series_signature,
                                               signature_properties, obj,
                                               _name, _test, series_data)

            # summary series
            # (skipping for now because of issues with size of property
            # tables)
            return
            summary_properties = {
                'suite': _suite,
                'subtest_signatures': json.dumps(subtest_signatures)
            }
            summary_properties.update(reference_data)
            summary_signature = self._get_series_signature(
                summary_properties)

            summary_data = self._calculate_summary_data(
                job_id, result_set_id, push_timestamp, talos_datum["results"])

            obj = self._get_base_perf_obj(_job_guid, _name, _type,
                                          talos_datum,
                                          summary_signature,
                                          summary_properties,
                                          summary_data)
            validate(obj, self.treeherder_perf_test_schema)
            self._add_performance_artifact(job_id, summary_signature,
                                           summary_properties, obj,
                                           _name, 'summary', summary_data)

    def get_series_signature(self, signature_values):

        sha = sha1()

        sha.update(''.join(map(lambda x: str(x), sorted(signature_values))))

        signature = sha.hexdigest()

        return signature

    def submit_tasks(self, project):

        from treeherder.model.tasks import populate_performance_series

        populate_performance_series.apply_async(
            args=[project, 'talos_data', self.signatures],
            routing_key='populate_performance_series'
        )
