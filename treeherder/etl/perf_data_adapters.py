import simplejson as json

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
                        "testsuite": { "type": "string" },
                        "sub_test": { "type": "string" },
                        "replicates": { "type": "list" }
                        }
                     },
                    "required": [
                        "series_signature", "replicates", "testsuite",
                        "sub_test"
                        ]
                },

            "required": ["blob", "job_guid", "name", "type"]
            }

        validate(self.data, self.datazilla_schema)

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
            "blob":{
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

        """
        {
            series_signature
        """
        pass

    def adapt_and_store(self, reference_data, datum):

        adapted_datum = self.adapt(reference_data, datum)

        self.adapted_data.append(adapted_datum)

    def get_series_signature(self, reference_data, datum):

        pass



