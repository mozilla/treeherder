import simplejson as json
from hashlib import sha1
import math

from jsonschema import validate, ValidationError

class PerformanceDataAdapter(object):
    """
    Base class for translating different performance data structures into
    treeherder performance artifacts.
    """

    performance_types = set([
        'performance'
    ])

    def __init__(self, data={}):

        self.data = data

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

        validate(self.data, self.datazilla_schema)

    def calculate_series_data(self, replicates):
        replicates.sort()
        r = replicates

        def avg(x, y):
            return (x + y) / 2

        return {
            "min": min(r),
            "max": max(r),
            "mean": float(sum(r))/len(r) if len(r) > 0 else float('nan'),
            "median": r[int(math.floor(len(r)/2))] if (len(r)%2 == 1) else avg(r[(len(r)/2) - 1], r[len(r/2)])
        }

class TalosDataAdapter(PerformanceDataAdapter):

    def __init__(self, data={}):

        super(TalosDataAdapter, self).__init__(data)

        self.adapted_data = []

    def pre_adapt(self, job_guid, name, obj_type):
        """Adapt the talos data into the structure that the web service
           can interpret"""

        performance_artifact = {
            "job_guid": job_guid,
            "name": name,
            "type": obj_type,
            "blob": {
                "testmachine": self.data["test_machine"],
                "testbuild": self.data["test_build"],
                "testrun": self.data["testrun"],
                "results": self.data["results"]
            }
        }

        if "test_aux" in self.data:
            performance_artifact["blob"]["test_aux"] = self.data["test_aux"]

        return performance_artifact

    def adapt(self, reference_data, datum):

        series_signature = self.get_series_signature(reference_data, datum)

        _job_guid = datum["job_guid"]
        _name = datum["name"]
        _type = "performance"
        _suite = datum["blob"]["testrun"]["suite"]

        ret = []

        for test in datum["blob"]["results"]:
            obj = {
                "job_guid": _job_guid,
                "name": _name,
                "type": _type,
                "blob": {
                    "series_signature": series_signature,
                    "testsuite": _suite,
                    "test": test,
                    "performance_series": self.calculate_series_data(datum["blob"]["results"][test]),
                    "replicates": datum["blob"]["results"][test],
                    "metadata": datum["blob"]["testrun"]["options"] if datum["blob"]["testrun"]["options"] else None
                }
            }

            validate(obj, self.treeherder_perf_test_schema)

            ret.append(obj)

        return ret

    def adapt_and_store(self, reference_data, datum):

        adapted_datum = self.adapt(reference_data, datum)

        self.adapted_data.append(adapted_datum)

    def get_series_signature(self, reference_data, datum):

        datum_properties = {
            "test_machine": datum["blob"]["test_machine"],
            "testrun": datum["blob"]["testrun"]
        }

        signature_properties = dict(reference_data.items() + datum_properties.items())

        sha = sha1()

        sha.update(''.join(map(lambda x: str(x), signature_properties)))

        return sha.hexdigest()