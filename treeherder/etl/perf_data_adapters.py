import datetime
import logging
import math
from hashlib import sha1

import simplejson as json
from jsonschema import validate
from simplejson import encoder

from treeherder.model.models import (MachinePlatform,
                                     OptionCollection,
                                     Repository)
from treeherder.perf.models import (PerformanceFramework,
                                    PerformanceSignature,
                                    PerformanceDatum)


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

    datazilla_schema = {
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
        suite_data["geomean"] = summary["suite"]
        return suite_data

    @staticmethod
    def _calculate_summary_data(results):
        values = []
        for test in results:
            values += results[test]

        if values:
            geomean = math.exp(sum(map(lambda v: math.log(v+1),
                                       values))/len(values))-1
        else:
            geomean = 0.0

        return {'geomean': geomean}

    @staticmethod
    def _extract_test_data(summary):
        datum = {}

        for measure in ["min", "max", "std", "median", "mean"]:
            datum[measure] = PerformanceDataAdapter._round(
                summary[measure])

        # some subtests (e.g. Dromaeo) have a custom "value" property which is
        # used to weigh the values of the replicates differently (dropping
        # some, etc.). we should use it where available
        if summary.get("value"):
            datum["value"] = PerformanceDataAdapter._round(
                summary["value"])

        return datum

    @staticmethod
    def _calculate_test_data(replicates):
        datum = {}

        replicates.sort()
        r = replicates
        r_len = len(replicates)

        if r_len > 0:
            def avg(s):
                return float(sum(r)) / r_len

            mean = float(sum(r))/r_len
            datum["mean"] = PerformanceDataAdapter._round(mean)

            if r_len > 1:
                variance = map(lambda x: (x - mean)**2, replicates)
                datum["min"] = PerformanceDataAdapter._round(min(r))
                datum["max"] = PerformanceDataAdapter._round(max(r))
                datum["std"] = PerformanceDataAdapter._round(
                    math.sqrt(avg(variance)))

                if len(r) % 2 == 1:
                    datum["median"] = PerformanceDataAdapter._round(
                        r[int(math.floor(len(r)/2))])
                else:
                    datum["median"] = PerformanceDataAdapter._round(
                        avg([r[(len(r)/2) - 1], r[len(r)/2]]))

        return datum

    @staticmethod
    def get_signature_hash(signature_properties):
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


class TalosDataAdapter(PerformanceDataAdapter):

    # keys useful for creating a non-redundant performance signature
    SIGNIFICANT_REFERENCE_DATA_KEYS = ['option_collection_hash',
                                       'machine_platform']

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

    def adapt_and_load(self, project_name, reference_data, job_data, datum):
        if 'e10s' in reference_data.get('job_group_symbol', ''):
            extra_properties = {'test_options': ['e10s']}
        else:
            extra_properties = {}

        # transform the reference data so it only contains what we actually
        # care about (for calculating the signature hash reproducibly), then
        # get the associated models
        reference_data = self._transform_signature_properties(reference_data)
        option_collection = OptionCollection.objects.get(
            option_collection_hash=reference_data['option_collection_hash'])
        framework, _ = PerformanceFramework.objects.get_or_create(
            name='talos')
        # there may be multiple machine platforms with the same platform: use
        # the first
        platform = MachinePlatform.objects.filter(
            platform=reference_data['machine_platform'])[0]
        repository = Repository.objects.get(
            name=project_name)

        # Get just the talos datazilla structure for treeherder
        target_datum = json.loads(datum['blob'])
        for talos_datum in target_datum['talos_data']:
            validate(talos_datum, self.datazilla_schema)
            _job_guid = datum["job_guid"]
            _suite = talos_datum["testrun"]["suite"]

            # data for performance series
            job_id = job_data[_job_guid]['id']
            result_set_id = job_data[_job_guid]['result_set_id']
            push_timestamp = datetime.datetime.fromtimestamp(
                job_data[_job_guid]['push_timestamp'])

            # counters will not be part of the summary series
            # counters have a json obj {'stat': val} instead of [val1, val2, ...]
            if 'talos_counters' in talos_datum:
                for _test in talos_datum["talos_counters"].keys():
                    signature_properties = {
                        'suite': _suite,
                        'test': _test
                    }
                    signature_properties.update(reference_data)
                    signature_properties.update(extra_properties)
                    signature_hash = self.get_signature_hash(
                        signature_properties)

                    signature, _ = PerformanceSignature.objects.get_or_create(
                        signature_hash=signature_hash,
                        test=_test,
                        suite=_suite,
                        option_collection=option_collection,
                        platform=platform,
                        framework=framework,
                        extra_properties=extra_properties)

                    results = {}
                    for stat in ['min', 'max', 'mean', 'median', 'std']:
                        if stat in talos_datum["talos_counters"][_test]:
                            # in case we have non int/float data, lets ignore it
                            try:
                                results[stat] = float(
                                    talos_datum["talos_counters"][_test][stat])
                            except:
                                logger.warning("Talos counters for job %s, "
                                               "result_set %s, and counter named %s "
                                               "have an unknown value: %s" %
                                               (job_id, result_set_id, _test,
                                                talos_datum["talos_counters"][_test]))
                                continue
                    PerformanceDatum.objects.get_or_create(
                        repository=repository,
                        result_set_id=result_set_id,
                        job_id=job_id,
                        signature=signature,
                        datum=results,
                        push_timestamp=push_timestamp)

            subtest_signatures = []

            # series for all the subtests
            for _test in talos_datum["results"].keys():

                signature_properties = {
                    'suite': _suite,
                    'test': _test
                }
                signature_properties.update(reference_data)

                signature_hash = self.get_signature_hash(
                    signature_properties)
                subtest_signatures.append(signature_hash)

                signature, _ = PerformanceSignature.objects.get_or_create(
                    signature_hash=signature_hash,
                    test=_test,
                    suite=_suite,
                    option_collection=option_collection,
                    platform=platform,
                    framework=framework,
                    extra_properties=extra_properties)

                if "summary" in talos_datum:
                    # most talos results should provide a summary of their
                    # subtest results based on an internal calculation of
                    # the replicates, use that if available
                    results = self._extract_test_data(
                        talos_datum["summary"]["subtests"][_test])
                else:
                    # backwards compatibility for older versions of talos
                    # and android talos which don't provide this summary
                    # (at some point we can remove this)
                    results = self._calculate_test_data(
                        talos_datum["results"][_test])

                PerformanceDatum.objects.get_or_create(
                    repository=repository,
                    result_set_id=result_set_id,
                    job_id=job_id,
                    signature=signature,
                    datum=results,
                    push_timestamp=push_timestamp)

            if subtest_signatures:
                # summary series
                extra_summary_properties = {
                    'subtest_signatures': sorted(subtest_signatures)
                }
                extra_summary_properties.update(extra_properties)
                summary_properties = {'suite': _suite}
                summary_properties.update(reference_data)
                summary_properties.update(extra_summary_properties)
                summary_signature_hash = self.get_signature_hash(
                    summary_properties)
                signature, _ = PerformanceSignature.objects.get_or_create(
                    signature_hash=summary_signature_hash,
                    test='',
                    suite=_suite,
                    option_collection=option_collection,
                    platform=platform,
                    framework=framework,
                    extra_properties=extra_summary_properties)

                if "summary" in talos_datum and "suite" in talos_datum["summary"]:
                    results = {"geomean": talos_datum["summary"]["suite"]}
                else:
                    results = self._calculate_summary_data(talos_datum["results"])

                PerformanceDatum.objects.get_or_create(
                    repository=repository,
                    result_set_id=result_set_id,
                    job_id=job_id,
                    signature=signature,
                    datum=results,
                    push_timestamp=push_timestamp)
