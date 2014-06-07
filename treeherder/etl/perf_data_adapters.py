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
                        "test": { "type": "string" },
                        "replicates": { "type": "list" },
                        "metadata": {"type": "object"} #added (holds 'options' from talos data & talos_aux [if present])
                        }
                     },
                    "required": [
                        "series_signature", "replicates", "testsuite",
                        "test"
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

        #get suite name
        #per entry in results create new signature for each page

        #ref data is from ref_data_signature
        #datum is talos blob

        #insert_on_duplicate_key_update https://dev.mysql.com/doc/refman/5.0/en/insert-on-duplicate.html

        #insert into series_signature(signature, property, value) DUPLICATE KEY UPDATE 
