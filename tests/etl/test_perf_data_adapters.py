import json
import zlib

from tests.sampledata import SampleData
from treeherder.etl.perf_data_adapters import TalosDataAdapter


def test_adapt_and_load():

    talos_perf_data = SampleData.get_talos_perf_data()

    tda = TalosDataAdapter()

    result_count = 0
    for datum in talos_perf_data:

        datum = {
            "job_guid": 'oqiwy0q847365qiu',
            "name": "test",
            "type": "test",
            "blob": datum
        }

        job_data = {
            "oqiwy0q847365qiu": {
                "id": 1,
                "result_set_id": 1,
                "push_timestamp": 1402692388
            }
        }

        reference_data = {
            "property1": "value1",
            "property2": "value2",
            "property3": "value3"
        }

        # one extra result for the summary series
        result_count += len(datum['blob']["results"]) + 1

        # we create one performance series per counter
        if 'talos_counters' in datum['blob']:
            result_count += len(datum['blob']["talos_counters"])

        # Mimic production environment, the blobs are serialized
        # when the web service receives them
        datum['blob'] = json.dumps({'talos_data': [datum['blob']]})
        tda.adapt_and_load(reference_data, job_data, datum)

        # we upload a summary with a suite and subtest values, +1 for suite
        if 'summary' in datum['blob']:
            results = json.loads(zlib.decompress(tda.performance_artifact_placeholders[-1][4]))
            data = json.loads(datum['blob'])['talos_data'][0]
            assert results["blob"]["performance_series"]["geomean"] == data['summary']['suite']

            # deal with the subtests now
            for i in range(0, len(data['summary']['subtests'])):
                subresults = json.loads(zlib.decompress(tda.performance_artifact_placeholders[-1 - i][4]))
                if 'subtest_signatures' in subresults["blob"]['signature_properties']:
                    # ignore summary signatures
                    continue

                subdata = data['summary']['subtests'][subresults["blob"]['signature_properties']['test']]
                for datatype in ['min', 'max', 'mean', 'median', 'std']:
                    assert subdata[datatype] == subresults["blob"]["performance_series"][datatype]
                if 'value' in subdata.keys():
                    assert subdata['value'] == subresults["blob"]["performance_series"]['value']
        else:
            # FIXME: the talos data blob we're currently using contains datums with summaries and those without
            # we should probably test non-summarized data as well
            pass

    assert result_count == len(tda.performance_artifact_placeholders)
