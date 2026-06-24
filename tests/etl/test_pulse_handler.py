from unittest import mock

from django.test import TestCase

from treeherder.etl.taskcluster_pulse.handler import ignore_task
from treeherder.model.models import Repository, RepositoryGroup


@mock.patch("treeherder.etl.taskcluster_pulse.handler.projects_to_ingest", None)
class TestPulseHandler(TestCase):
    def setUp(self):
        self.group = RepositoryGroup.objects.create(name="test-group")

        # Existing mobile repo with master branch
        self.ref_browser = Repository.objects.create(
            name="reference-browser",
            repository_group=self.group,
            url="https://github.com/mozilla-mobile/reference-browser",
            branch="master",
            tc_root_url="https://firefox-ci-tc.services.mozilla.com",
        )

        # New repo (application-services) with main branch
        self.app_services = Repository.objects.create(
            name="application-services",
            repository_group=self.group,
            url="https://github.com/mozilla/application-services",
            branch="main",
            tc_root_url="https://firefox-ci-tc.services.mozilla.com",
        )

    def test_ignore_task_reference_browser_master(self):
        """Test that reference-browser on master branch"""
        task = {
            "payload": {
                "env": {
                    "MOBILE_BASE_REPOSITORY": "https://github.com/mozilla-mobile/reference-browser",
                    "MOBILE_HEAD_REPOSITORY": "https://github.com/mozilla-mobile/reference-browser",
                    "MOBILE_HEAD_REF": "master",
                }
            }
        }
        # Should return False (do not ignore)
        self.assertFalse(ignore_task(task, "task1", "root_url", "reference-browser"))

    def test_ignore_task_reference_browser_feature(self):
        """Test that reference-browser on feature branch is ignored"""
        task = {
            "payload": {
                "env": {
                    "MOBILE_BASE_REPOSITORY": "https://github.com/mozilla-mobile/reference-browser",
                    "MOBILE_HEAD_REPOSITORY": "https://github.com/mozilla-mobile/reference-browser",
                    "MOBILE_HEAD_REF": "feature-branch",
                }
            }
        }
        # Should return True (ignore)
        self.assertTrue(ignore_task(task, "task2", "root_url", "reference-browser"))

    def test_ignore_task_app_services_main(self):
        """Test that application-services on main branch is not ignored"""
        # Mocking decision task fallback
        with mock.patch("treeherder.etl.taskcluster_pulse.handler.taskcluster.Queue") as mock_queue:
            mock_client = mock.Mock()
            mock_queue.return_value = mock_client

            mock_client.task.return_value = {
                "metadata": {
                    "source": ["assume:repo:github.com/mozilla/application-services:branch:main"]
                },
                "routes": [],
            }

            task = {
                "taskGroupId": "group1",
                "payload": {
                    "env": {}  # No MOBILE_ env vars
                },
            }

            # Should return False (do not ignore)
            self.assertFalse(ignore_task(task, "task3", "root_url", "application-services"))

    def test_ignore_task_app_services_feature(self):
        """Test that application-services on feature branch is ignored"""
        with mock.patch("treeherder.etl.taskcluster_pulse.handler.taskcluster.Queue") as mock_queue:
            mock_client = mock.Mock()
            mock_queue.return_value = mock_client

            mock_client.task.return_value = {
                "metadata": {
                    "source": ["assume:repo:github.com/mozilla/application-services:branch:feature"]
                },
                "routes": [],
            }

            task = {"taskGroupId": "group1", "payload": {"env": {}}}

            # Should return True (ignore)
            self.assertTrue(ignore_task(task, "task4", "root_url", "application-services"))
