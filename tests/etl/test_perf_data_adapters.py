from tests.sampledata import SampleData

def test_talos_data_adapter():

    from treeherder.etl.perf_data_adapters import TalosDataAdapter

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

