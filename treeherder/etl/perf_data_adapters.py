# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import json
from json import encoder

from hashlib import sha1
import math

from jsonschema import validate, ValidationError

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

            "properties" : {
                "test_machine": { "type" : "object" },
                "testrun": { "type": "object" },
                "results": { "type": "object" },
                "test_build": { "type": "object" },
                "test_aux": { "type": "object" }
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

            "properties" : {
                "job_guid": { "type" : "string" },
                "name": { "type": "string" },
                "type": { "type": "string" },
                "blob": {
                    "type": "object",
                    "properties": {
                        "date": { "type": "integer" }, # time test was run
                        "series_properties": { "type": "object" },
                        "series_signature": {"type": "string"},
                        "testsuite": { "type": "string" },
                        "test": { "type": "string" },
                        "replicates": { "type": "array" },
                        "performance_series": {"type": "object"},
                        "metadata": {"type": "object"} # (holds 'options' from talos data & various auxiliary data including 'test_aux', 'talox_aux', 'results_aux', and 'results_xperf')
                    },
                    "required": [
                        "date", "series_signature", "replicates", "testsuite",
                        "test"
                    ]
                }
            },
            "required": ["blob", "job_guid", "name", "type"]
        }


    def calculate_series_data(
        self, job_id, result_set_id, push_timestamp, replicates):

        replicates.sort()
        r = replicates
        r_len = len(replicates)

        # Use a precision of .2f for all numbers stored
        # to insure we don't have floats with giant mantissa's
        # that inflate the size of the stored data structure
        precision = '%.2f'
        series_data = {
            "job_id": job_id,
            "result_set_id": result_set_id,
            "push_timestamp": push_timestamp,
            "total_replicates": r_len,
            "min": float( precision % round( min(r), 2 ) ),
            "max": float( precision % round( max(r), 2 ) ),
            "mean": 0,
            "std": 0,
            "median": 0
            }

        if r_len > 0:

            def avg(s):
                return float(sum(r)) / r_len

            mean = round( float(sum(r))/r_len, 2 )
            variance = map( lambda x: (x - mean)**2, replicates )

            series_data["mean"] = float( precision % mean )
            series_data["std"] = float(
                precision % round( math.sqrt(avg(variance)), 2 )
            )

            if len(r) % 2 == 1:
                series_data["median"] = float(
                    precision % round(
                    r[int(math.floor(len(r)/2))], 2 )
                )

            else:
                series_data["median"] = float(
                    precision % round(
                        avg([r[(len(r)/2) - 1], r[len(r)/2]]), 2 )
                )

        return series_data

class TalosDataAdapter(PerformanceDataAdapter):

    def __init__(self):

        super(TalosDataAdapter, self).__init__()

        self.adapted_data = []

        self.signatures = {}
        self.performance_artifact_placeholders = []
        self.signature_property_placeholders = []

    def adapt_and_load(self, reference_data, job_data, datum):

        # Get just the talos datazilla structure for treeherder
        target_datum = json.loads(datum['blob'])
        talos_datum = target_datum['talos_data'][0]

        validate(talos_datum, self.datazilla_schema)

        _job_guid = datum["job_guid"]
        _name = datum["name"]
        _type = "performance"
        _suite = talos_datum["testrun"]["suite"]

        # data for performance series
        job_id = job_data[_job_guid]['id']
        result_set_id = job_data[_job_guid]['result_set_id']
        push_timestamp = job_data[_job_guid]['push_timestamp']

        for _test in talos_datum["results"].keys():

            signature_properties = {}

            signature_properties.update(reference_data)
            signature_properties.update({
                'suite':_suite,
                'test':_test
                })

            signature_prop_values = signature_properties.keys()
            signature_prop_values.extend(signature_properties.values())

            series_signature = self.get_series_signature(
                signature_prop_values)

            series_data = self.calculate_series_data(
                job_id, result_set_id, push_timestamp,
                talos_datum["results"][_test]
                )

            obj = {
                "job_guid": _job_guid,
                "name": _name,
                "type": _type,
                "blob": {
                    "date": talos_datum["testrun"]["date"],
                    "series_signature": series_signature,
                    "signature_properties": signature_properties,
                    "performance_series": series_data,
                    "testsuite": _suite,
                    "test": _test,
                    "replicates": talos_datum["results"][_test],
                    "metadata":{}
                }
            }

            options = talos_datum["testrun"].get(
                "options", {})
            if options:
                obj['blob']['metadata']['options'] = options

            for key in [ 'test_aux', 'talos_aux', 'results_aux',
                         'results_xperf' ]:
                aux_blob = talos_datum.get(key)
                if aux_blob:
                    obj['blob']['metadata'][key] = aux_blob

            # test_build information (i.e. revision) just there to ease third
            # party alert processing, since we should normally be able to get
            # it by querying the job info
            obj['blob']['metadata']['test_build'] = talos_datum["test_build"]

            validate(obj, self.treeherder_perf_test_schema)

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
                _name,
                _test,
                json.dumps(obj)
                ])

            self.signatures[series_signature].append(series_data)

    def get_series_signature(self, signature_values):

        sha = sha1()

        sha.update(''.join(map(lambda x: str(x), sorted(signature_values))))

        signature = sha.hexdigest()

        return signature

    def submit_tasks(self, project):

        from treeherder.model.tasks import populate_performance_series

        populate_performance_series.apply_async(
            args=[project, 'talos_data', self.signatures]
        )
