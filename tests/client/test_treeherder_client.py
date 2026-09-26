import unittest

import responses

from treeherder.client.thclient import TreeherderClient


class TreeherderClientTest(unittest.TestCase):
    JOB_RESULTS = [{"jobDetail1": 1}, {"jobDetail2": 2}, {"jobDetail3": 3}]
    PUSHES = [{"push1": 1}, {"push2": 2}, {"push3": 3}]
    REPOSITORIES = [
        {
            "id": 6,
            "repository_group": {
                "name": "release-stabilization",
                "description": "Collection of repositories further along the release process",
            },
            "name": "mozilla-beta",
            "dvcs_type": "hg",
            "url": "https://hg.mozilla.org/releases/mozilla-beta",
            "codebase": "gecko",
            "description": "",
            "active_status": "active",
            "life_cycle_order": 100,
            "performance_alerts_enabled": True,
            "expire_performance_data": False,
            "is_try_repo": False,
            "tc_root_url": "https://firefox-ci-tc.services.mozilla.com",
            "accepts_pull_requests": False,
        },
        {
            "id": 22,
            "repository_group": {
                "name": "project repositories",
                "description": "Collection of repositories for project branches",
            },
            "name": "birch",
            "dvcs_type": "hg",
            "url": "https://hg.mozilla.org/projects/birch",
            "codebase": "gecko",
            "description": "",
            "active_status": "active",
            "life_cycle_order": None,
            "performance_alerts_enabled": False,
            "expire_performance_data": True,
            "is_try_repo": False,
            "tc_root_url": "https://firefox-ci-tc.services.mozilla.com",
            "accepts_pull_requests": False,
        },
    ]

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
    def test_get_repositories_empty_list(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.REPOSITORY_ENDPOINT)
        content = []
        responses.add(responses.GET, url, json=content, status=200)
        repositories = tdc.get_repositories()
        self.assertEqual(repositories, [])


if __name__ == "__main__":
    unittest.main()
