from tests.sampledata import SampleData
from treeherder.etl.perf_data_adapters import TalosDataAdapter

from tests.sample_data_generator import job_data, result_set
from tests.sampledata import SampleData
from tests import test_utils

def test_adapt_and_load():

    talos_perf_data = SampleData.get_talos_perf_data()

    ref_data = {
        "test": 1
    }

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
                "id":1,
                "result_set_id":1,
                "push_timestamp":1402692388
            }
        }

        reference_data = {
            "property1":"value1",
            "property2":"value2",
            "property3":"value3"
        }

        result_count += len(datum['blob']["results"])
        tda.adapt_and_load(reference_data, job_data, datum)

    assert result_count == len( tda.performance_artifact_placeholders )
    assert result_count == len( tda.series_signature_data )

