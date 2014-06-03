from treeherder.etl.pulse import PulseDataAdapter, TreeherderPulseDataAdapter


def test_process_data(sample_data):
    """
Test the ability of PulseDataAdapter.process_data() to process the
raw data available in sample_data without missing any attributes.
"""

    pda = PulseDataAdapter(
        durable=False,
        logdir='logs',
        rawdata=False,
        outfile=None
    )

    msg = Message()

    for data in sample_data.raw_pulse_data:

        data = pda.process_data(data, msg)

        missing_attributes = pda.required_attributes.difference(
            set(data.keys())
        )

        assert set() == missing_attributes


class Message(object):
    """Class that mimics the message object interface from
mozilla pulse"""
    def __init__(self):
        pass

    def ack(self):
        pass


def test_load_data(sample_data, jm, mock_post_json_data,
                   initial_data, mock_get_resultset):
    """
    Test the ability of TreeherderPulseDataAdapter to load its transformed
    data through the restful api
    """
    tpda = TreeherderPulseDataAdapter(
        loaddata=True,
        durable=False,
        logdir='logs',
        rawdata=False,
        outfile=None
    )

    msg = Message()

    for data in sample_data.raw_pulse_data[:1]:
        # change the branch (aka project) name on the raw data,
        # so that we can use the dataset created by jm
        data['payload']['build']['properties'][1][1] = jm.project
        data = tpda.process_data(data, msg)

    stored_obj = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.all")

    jm.disconnect()

    assert len(stored_obj) == 1


def test_load_data_missing_attribute(sample_data, jm, mock_post_json_data, initial_data):
    """
    Test that no objects is inserted in the object store if there is a missing attribute
    """
    tpda = TreeherderPulseDataAdapter(
        loaddata=True,
        durable=False,
        logdir='logs',
        rawdata=False,
        outfile=None
    )

    msg = Message()

    for data in sample_data.raw_pulse_data[:1]:
        # change the branch (aka project) name on the raw data,
        # so that we can use the dataset created by jm

        # delete the buildid attribute
        data['payload']['build']['properties'][4][0] = ""
        data['payload']['build']['properties'][1][1] = jm.project
        tpda.process_data(data, msg)

    stored_obj = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.all")

    jm.disconnect()

    assert len(stored_obj) == 0
