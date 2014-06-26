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
        'performance'
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
                        "series_properties": { "type": "object" },
                        "series_signature": {"type": "string"},
                        "testsuite": { "type": "string" },
                        "test": { "type": "string" },
                        "replicates": { "type": "array" },
                        "performance_series": {"type": "object"},
                        "metadata": {"type": "object"} #added (holds 'options' from talos data & talos_aux [if present])
                    },
                    "required": [
                        "series_signature", "replicates", "testsuite",
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

        datum['blob'] = json.loads(datum['blob'])

        validate(datum['blob'], self.datazilla_schema)

        _job_guid = datum["job_guid"]
        _name = datum["name"]
        _type = "performance"
        _suite = datum["blob"]["testrun"]["suite"]

        # data for performance series
        job_id = job_data[_job_guid]['id']
        result_set_id = job_data[_job_guid]['result_set_id']
        push_timestamp = job_data[_job_guid]['push_timestamp']

        for _test in datum["blob"]["results"].keys():

            signature_properties = {}

            signature_properties.update(reference_data)
            signature_properties.update({
                'suite':_suite,
                'test':_test
                })

            series_signature = self.get_series_signature(
                signature_properties.values()
                )

            series_data = self.calculate_series_data(
                job_id, result_set_id, push_timestamp,
                datum["blob"]["results"][_test]
                )

            obj = {
                "job_guid": _job_guid,
                "name": _name,
                "type": _type,
                "blob": {
                    "series_signature": series_signature,
                    "signature_properties": signature_properties,
                    "performance_series": series_data,
                    "testsuite": _suite,
                    "test": _test,
                    "replicates": datum["blob"]["results"][_test],
                    "metadata":{}
                }
            }

            options = datum["blob"]["testrun"].get(
                "options", {})
            if options:
                obj['blob']['metadata']['options'] = options

            test_aux = datum["blob"].get(
                "test_aux", {})
            if test_aux:
                obj['blob']['metadata']['auxiliary_data'] = test_aux

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

        sha.update(''.join(map(lambda x: str(x), signature_values)))

        signature = sha.hexdigest()

        return signature

    def submit_tasks(self, project):

        from treeherder.model.tasks import populate_performance_series

        populate_performance_series.apply_async(
            args=[project, 'talos_data', self.signatures]
        )
