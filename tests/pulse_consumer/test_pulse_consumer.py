from treeherder.pulse_consumer.consumer import PulseDataAdapter, TreeherderDataAdapter
from ..sampledata import SampleData

def test_process_data():

    sd = SampleData()

    pda = PulseDataAdapter(
        durable=False,
        logdir='logs',
        rawdata=False,
        outfile=None
        )

    msg = Message()

    for data in sd.raw_pulse_data:

        data = pda.process_data(data, msg)

        missing_attributes = pda.required_attributes.difference(
            set( data.keys() )
            )

        assert set() == missing_attributes

class Message(object):

    def __init__(self):
        pass

    def ack(self):
        pass
