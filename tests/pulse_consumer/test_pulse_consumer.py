import pytest

from treeherder.pulse_consumer.consumer import PulseDataAdapter


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
            set( data.keys() )
            )

        assert set() == missing_attributes

class Message(object):
    """Class that mimics the message object interface from
       mozilla pulse"""
    def __init__(self):
        pass

    def ack(self):
        pass
