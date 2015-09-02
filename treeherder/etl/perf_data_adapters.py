import logging
import math
from hashlib import sha1

import simplejson as json
from jsonschema import validate
from simplejson import encoder

logger = logging.getLogger(__name__)

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

    @staticmethod
    def _round(num):
        # Use a precision of .2f for all numbers stored
        # to insure we don't have floats with giant mantissa's
        # that inflate the size of the stored data structure
        return round(num, 2)

    @staticmethod
    def _extract_summary_data(suite_data, summary):
        suite_data["value"] = summary["suite"]
        return suite_data

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
            "value": PerformanceDataAdapter._round(geomean)
        }

    @staticmethod
    def _extract_test_data(series_data, summary):
        if not isinstance(summary, dict):
            return series_data

        # "filtered" currently means the fully calculated subtest
        # value
        series_data["value"] = PerformanceDataAdapter._round(
            summary["filtered"])

        return series_data

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
            "value": 0
        }

        if r_len > 0:
            def avg(s):
                return float(sum(r)) / r_len

            mean = float(sum(r))/r_len
            series_data["value"] = PerformanceDataAdapter._round(mean)

            if r_len > 1:
                if len(r) % 2 == 1:
                    series_data["value"] = PerformanceDataAdapter._round(
                        r[int(math.floor(len(r)/2))])
                else:
                    series_data["value"] = PerformanceDataAdapter._round(
                        avg([r[(len(r)/2) - 1], r[len(r)/2]]))

        return series_data

    @staticmethod
    def get_series_signature(signature_properties):
        signature_prop_values = signature_properties.keys()
        str_values = []
        for value in signature_properties.values():
            if not isinstance(value, basestring):
                str_values.append(json.dumps(value))
            else:
                str_values.append(value)
        signature_prop_values.extend(str_values)

        sha = sha1()
        sha.update(''.join(map(lambda x: str(x), sorted(signature_prop_values))))

        return sha.hexdigest()

    def _add_performance_placeholder(self, series_signature,
                                     signature_properties,
                                     testdata):
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

        self.signatures[series_signature].append(testdata)


class TalosDataAdapter(PerformanceDataAdapter):

    # keys useful for creating a non-redundant performance signature
    SIGNIFICANT_REFERENCE_DATA_KEYS = ['option_collection_hash',
                                       'machine_platform']

    def __init__(self):

        super(TalosDataAdapter, self).__init__()

        self.adapted_data = []

        self.signatures = {}
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

    @staticmethod
    def _transform_signature_properties(properties, significant_keys=None):
        if significant_keys is None:
            significant_keys = TalosDataAdapter.SIGNIFICANT_REFERENCE_DATA_KEYS
        transformed_properties = {}
        keys = properties.keys()
        for k in keys:
            if k in significant_keys:
                transformed_properties[k] = properties[k]

        # HACK: determine if e10s is in job_group_symbol, and add an "e10s"
        # property to a 'test_options' property if so (we should probably
        # make talos produce this information somehow and consume it in the
        # future)
        if 'e10s' in properties.get('job_group_symbol', ''):
            transformed_properties['test_options'] = json.dumps(['e10s'])

        return transformed_properties

    def adapt_and_load(self, reference_data, job_data, datum):
        # transform the reference data so it only contains what we actually
        # care about
        reference_data = self._transform_signature_properties(reference_data)

        # Get just the talos datazilla structure for treeherder
        target_datum = json.loads(datum['blob'])
        for talos_datum in target_datum['talos_data']:
            validate(talos_datum, self.datazilla_schema)

            _job_guid = datum["job_guid"]
            _suite = talos_datum["testrun"]["suite"]

            # data for performance series
            job_id = job_data[_job_guid]['id']
            result_set_id = job_data[_job_guid]['result_set_id']
            push_timestamp = job_data[_job_guid]['push_timestamp']

            # counters will not be part of the summary series
            # counters have a json obj {'stat': val} instead of [val1, val2, ...]
            if 'talos_counters' in talos_datum:
                for _test in talos_datum["talos_counters"].keys():
                    signature_properties = {
                        'suite': _suite,
                        'test': _test
                    }
                    signature_properties.update(reference_data)

                    series_signature = self.get_series_signature(
                        signature_properties)

                    try:
                        series_data = {
                            "job_id": job_id,
                            "result_set_id": result_set_id,
                            "push_timestamp": push_timestamp,
                            "value": float(
                                talos_datum["talos_counters"][_test]["mean"])
                        }
                    except:
                        logger.warning("Talos counters for job %s, "
                                       "result_set %s, and counter named %s "
                                       "have an unexpected value: %s" %
                                       (job_id, result_set_id, _test,
                                        talos_datum["talos_counters"][_test]))
                        continue

                    self._add_performance_placeholder(
                        series_signature, signature_properties, series_data)

            subtest_signatures = []

            # series for all the subtests
            for _test in talos_datum["results"].keys():

                signature_properties = {
                    'suite': _suite,
                    'test': _test
                }
                signature_properties.update(reference_data)

                series_signature = self.get_series_signature(
                    signature_properties)
                subtest_signatures.append(series_signature)

                series_data = self._calculate_test_data(
                    job_id, result_set_id, push_timestamp,
                    talos_datum["results"][_test])

                if "summary" in talos_datum and talos_datum["summary"]["subtests"][_test]:
                    summary_data = talos_datum["summary"]["subtests"][_test]
                    series_data = self._extract_test_data(series_data,
                                                          summary_data)

                self._add_performance_placeholder(
                    series_signature, signature_properties, series_data)

            if subtest_signatures:
                # summary series
                summary_properties = {
                    'suite': _suite,
                    'subtest_signatures': json.dumps(sorted(subtest_signatures))
                }
                summary_properties.update(reference_data)
                summary_signature = self.get_series_signature(
                    summary_properties)

                summary_data = self._calculate_summary_data(
                    job_id, result_set_id, push_timestamp, talos_datum["results"])

                if "summary" in talos_datum and "suite" in talos_datum["summary"]:
                    summary_data = self._extract_summary_data(summary_data,
                                                              talos_datum["summary"])

                self._add_performance_placeholder(
                    summary_signature, summary_properties,
                    summary_data)

    def submit_tasks(self, project):

        from treeherder.model.tasks import populate_performance_series

        populate_performance_series.apply_async(
            args=[project, 'talos_data', self.signatures],
            routing_key='populate_performance_series'
        )
