import unittest

from mock import patch

from treeherder.client import PerfherderClient


class PerfherderClientTest(unittest.TestCase):

    def _get_mock_response(self, response_struct):
        class MockResponse(object):

            def json(self):
                return response_struct

            def raise_for_status(self):
                pass

        return MockResponse()

    @patch("treeherder.client.client.requests.get")
    def test_get_performance_signatures(self, mock_get):

        mock_get.return_value = self._get_mock_response(
            {'signature1': {'cheezburgers': 1},
             'signature2': {'hamburgers': 2},
             'signature3': {'cheezburgers': 2}})
        pc = PerfherderClient()
        sigs = pc.get_performance_signatures('mozilla-central')
        self.assertEqual(len(sigs), 3)
        self.assertEqual(sigs.get_signature_hashes(), ['signature1',
                                                       'signature2',
                                                       'signature3'])
        self.assertEqual(sigs.get_property_names(),
                         set(['cheezburgers', 'hamburgers']))
        self.assertEqual(sigs.get_property_values('cheezburgers'), set([1, 2]))

    @patch("treeherder.client.client.requests.get")
    def test_get_performance_data(self, mock_get):

        mock_get.return_value = self._get_mock_response({
            'signature1': [{'value': 1}, {'value': 2}],
            'signature2': [{'value': 2}, {'value': 1}]
        })
        pc = PerfherderClient()
        series_list = pc.get_performance_data('mozilla-central',
                                              signatures=['signature1',
                                                          'signature2'])
        self.assertEqual(len(series_list), 2)
        self.assertEqual(series_list['signature1']['value'], [1, 2])
        self.assertEqual(series_list['signature2']['value'], [2, 1])
