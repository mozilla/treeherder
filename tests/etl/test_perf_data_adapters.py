from tests.sampledata import SampleData
from treeherder.etl.perf_data_adapters import TalosDataAdapter

from tests.sample_data_generator import job_data, result_set
from tests.sampledata import SampleData
from tests import test_utils

def test_talos_data_adapter():
    talos_perf_data = SampleData.get_talos_perf_data()

    name = 'talos'
    obj_type = 'performance'
    job_guid = 'lakjsdfhlaksj'

    pre_adapted_data = []
    for datum in talos_perf_data:

        tda = TalosDataAdapter(datum)

        # Confirm pre_adapt doesn't raise any exceptions
        a = tda.pre_adapt(job_guid, name, obj_type)
        pre_adapted_data.append(a)

def test_get_series_signature():
    talos_perf_data = SampleData.get_talos_perf_data()

    ref_data = {
        "test": 1
    }

    datum = {
        "job_guid": 1,
        "name": "test",
        "type": "test",
        "blob": talos_perf_data[0]
    }

    tda = TalosDataAdapter(datum["blob"])

    sig = tda.get_series_signature(ref_data, datum, "name")

    assert sig is not None

def test_adapt_data():
    talos_perf_data = SampleData.get_talos_perf_data()

    ref_data = {
        "test": 1
    }

    datum = {
        "job_guid": "abc",
        "name": "test",
        "type": "test",
        "blob": talos_perf_data[0]
    }

    tda = TalosDataAdapter(datum["blob"])

    ret = tda.adapt(ref_data, datum)

    assert len(ret) is len(talos_perf_data[0]["results"])