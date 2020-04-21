import unittest

import responses

from treeherder.client.thclient import TreeherderClient


class TreeherderClientTest(unittest.TestCase):
    JOB_RESULTS = [{"jobDetail1": 1}, {"jobDetail2": 2}, {"jobDetail3": 3}]
    PUSHES = [{"push1": 1}, {"push2": 2}, {"push3": 3}]

    @responses.activate
    def test_get_job(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.JOBS_ENDPOINT, project='mozilla-inbound')
        content = {
            "meta": {"count": 3, "repository": "mozilla-inbound", "offset": 0},
            "results": self.JOB_RESULTS,
        }
        responses.add(responses.GET, url, json=content, match_querystring=True, status=200)

        jobs = tdc.get_jobs("mozilla-inbound")
        self.assertEqual(len(jobs), 3)
        self.assertEqual(jobs, self.JOB_RESULTS)

    @responses.activate
    def test_get_pushes(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.PUSH_ENDPOINT, project='mozilla-inbound')
        content = {
            "meta": {"count": 3, "repository": "mozilla-inbound", "offset": 0},
            "results": self.PUSHES,
        }
        responses.add(responses.GET, url, json=content, match_querystring=True, status=200)

        pushes = tdc.get_pushes("mozilla-inbound")
        self.assertEqual(len(pushes), 3)
        self.assertEqual(pushes, self.PUSHES)


if __name__ == '__main__':
    unittest.main()
