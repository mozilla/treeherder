import unittest

import responses

from treeherder.client import PerfherderClient


class PerfherderClientTest(unittest.TestCase):

    @responses.activate
    def test_get_performance_signatures(self):
        pc = PerfherderClient()
        url = pc._get_endpoint_url(pc.PERFORMANCE_SIGNATURES_ENDPOINT, project='mozilla-central')
        content = {
            'signature1': {'cheezburgers': 1},
            'signature2': {'hamburgers': 2},
            'signature3': {'cheezburgers': 2}
        }
        responses.add(responses.GET, url, json=content, match_querystring=True, status=200)

        sigs = pc.get_performance_signatures('mozilla-central')
        self.assertEqual(len(sigs), 3)
        self.assertEqual(sigs.get_signature_hashes(), ['signature1',
                                                       'signature2',
                                                       'signature3'])
        self.assertEqual(sigs.get_property_names(),
                         set(['cheezburgers', 'hamburgers']))
        self.assertEqual(sigs.get_property_values('cheezburgers'), set([1, 2]))

    @responses.activate
    def test_get_performance_data(self):
        pc = PerfherderClient()

        url = '{}?{}'.format(pc._get_endpoint_url(pc.PERFORMANCE_DATA_ENDPOINT, project='mozilla-central'),
                             'signatures=signature1&signatures=signature2')
        content = {
            'signature1': [{'value': 1}, {'value': 2}],
            'signature2': [{'value': 2}, {'value': 1}]
        }
        responses.add(responses.GET, url, json=content, match_querystring=True, status=200)

        series_list = pc.get_performance_data('mozilla-central',
                                              signatures=['signature1',
                                                          'signature2'])
        self.assertEqual(len(series_list), 2)
        self.assertEqual(series_list['signature1']['value'], [1, 2])
        self.assertEqual(series_list['signature2']['value'], [2, 1])
