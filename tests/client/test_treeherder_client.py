import unittest

import requests
import responses

from treeherder.client.thclient import TreeherderClient


class TreeherderClientTest(unittest.TestCase):
    JOB_RESULTS = [{"jobDetail1": 1}, {"jobDetail2": 2}, {"jobDetail3": 3}]
    PUSHES = [{"push1": 1}, {"push2": 2}, {"push3": 3}]

    @responses.activate
    def test_get_job(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.JOBS_ENDPOINT, project="autoland")
        content = {
            "meta": {"count": 3, "repository": "autoland", "offset": 0},
            "results": self.JOB_RESULTS,
        }
        responses.add(responses.GET, url, json=content, status=200)

        jobs = tdc.get_jobs("autoland")
        self.assertEqual(len(jobs), 3)
        self.assertEqual(jobs, self.JOB_RESULTS)

    @responses.activate
    def test_get_pushes(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.PUSH_ENDPOINT, project="autoland")
        content = {
            "meta": {"count": 3, "repository": "autoland", "offset": 0},
            "results": self.PUSHES,
        }
        responses.add(responses.GET, url, json=content, status=200)

        pushes = tdc.get_pushes("autoland")
        self.assertEqual(len(pushes), 3)
        self.assertEqual(pushes, self.PUSHES)

    @responses.activate
    def test_get_repositories(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.REPOSITORY_ENDPOINT)
        content = [{"name": "autoland", "dvcs_type": "hg"}, {"name": "mozilla-central", "dvcs_type": "hg"}]
        responses.add(responses.GET, url, json=content, status=200)

        repositories = tdc.get_repositories()
        self.assertEqual(repositories, content)

    @responses.activate
    def test_get_failure_classifications(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.FAILURE_CLASSIFICATION_ENDPOINT)
        content = [{"id": 1, "name": "infra", "description": "infrastructure issue"}]
        responses.add(responses.GET, url, json=content, status=200)

        classifications = tdc.get_failure_classifications()
        self.assertEqual(classifications, content)

    @responses.activate
    def test_get_option_collection_hash(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.OPTION_COLLECTION_HASH_ENDPOINT)
        content = [
            {"option_collection_hash": "hash1", "options": [{"opt1": "val1"}]},
            {"option_collection_hash": "hash2", "options": [{"opt2": "val2"}]},
        ]
        responses.add(responses.GET, url, json=content, status=200)

        result = tdc.get_option_collection_hash()
        expected = {
            "hash1": [{"opt1": "val1"}],
            "hash2": [{"opt2": "val2"}],
        }
        self.assertEqual(result, expected)

    @responses.activate
    def test_get_job_log_url(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.JOB_LOG_URL_ENDPOINT, project="autoland")
        content = [{"id": 101, "url": "https://example.com/log"}]
        responses.add(responses.GET, url, json=content, status=200)

        result = tdc.get_job_log_url("autoland")
        self.assertEqual(result, content)

    @responses.activate
    def test_custom_server_url(self):
        tdc = TreeherderClient(server_url="https://custom.treeherder.org")
        url = "https://custom.treeherder.org/api/repository/"
        responses.add(responses.GET, url, json=[], status=200)

        tdc.get_repositories()
        self.assertEqual(len(responses.calls), 1)
        self.assertTrue(responses.calls[0].request.url.startswith("https://custom.treeherder.org"))

    @responses.activate
    def test_headers(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.REPOSITORY_ENDPOINT)
        responses.add(responses.GET, url, json=[], status=200)

        tdc.get_repositories()
        self.assertEqual(len(responses.calls), 1)
        headers = responses.calls[0].request.headers
        self.assertEqual(headers["Accept"], "application/json; version=1.1")
        self.assertEqual(headers["User-Agent"], "treeherder-pyclient/5.0.0")

    @responses.activate
    def test_get_json_http_500_logging_and_exception(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.REPOSITORY_ENDPOINT)
        responses.add(responses.GET, url, body="Internal Server Error", status=500)

        with self.assertLogs("treeherder.client.thclient.client", level="ERROR") as cm:
            with self.assertRaises(requests.exceptions.HTTPError):
                tdc.get_repositories()

        self.assertTrue(
            any("500" in log and url in log and "Internal Server Error" in log for log in cm.output)
        )


if __name__ == "__main__":
    unittest.main()
