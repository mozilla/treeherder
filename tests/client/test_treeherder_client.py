from __future__ import unicode_literals

import json
import os
import unittest

import responses
from requests_hawk import HawkAuth
from six import iteritems

from treeherder.client.thclient import (TreeherderClient,
                                        TreeherderClientError,
                                        TreeherderJob,
                                        TreeherderJobCollection)


class DataSetup(unittest.TestCase):

    def setUp(self):

        # Load sample job data
        self.job_data = []

        job_data_file = 'job_data.json'

        self.job_data_file_path = os.path.join(
            os.path.dirname(__file__),
            'data',
            job_data_file
            )

        with open(self.job_data_file_path) as f:
            self.job_data = json.load(f)

    def compare_structs(self, struct1, struct2):
        """Compare two dictionary structures"""

        for k1, v1 in iteritems(struct1):

            self.assertTrue(
                k1 in struct2,
                'struct1 key, {0}, not found in struct2'.format(k1))

            if isinstance(v1, dict):

                self.assertTrue(
                    isinstance(struct2[k1], dict),
                    'struct2 value not a dict for key {0}'.format(k1))

                # recursively iterate through any dicts found
                self.compare_structs(v1, struct2[k1])

            elif isinstance(v1, list):

                self.assertTrue(
                    isinstance(struct2[k1], list),
                    'struct2 not a list for key {0}'.format(k1))

                self.assertEqual(
                    v1, struct2[k1],
                    ('struct1 and struct2 not equal for key {0}\n'
                     'struct1[{0}] = {1}\n'
                     'struct2[{0}] = {2}\n').format(k1, v1, struct2[k1])
                    )

            else:
                self.assertEqual(
                    v1, struct2[k1],
                    ('struct1[{0}], {1} != struct2[{0}], '
                     '{2}'.format(k1, v1, struct2[k1]))
                    )


class TreeherderJobCollectionTest(DataSetup, unittest.TestCase):

    def test_job_collection(self):
        """Confirm the collection matches the sample data"""
        tjc = TreeherderJobCollection()

        for job in self.job_data:
            tj = TreeherderJob(job)
            tjc.add(tj)

        self.assertTrue(len(self.job_data) == len(tjc.data))

    def test_job_collection_job_type(self):
        """
        Confirm that the job_type argument changes the endpoint_base property
        """

        tjc = TreeherderJobCollection()

        self.assertTrue(tjc.endpoint_base, 'jobs')


class TreeherderJobTest(DataSetup, unittest.TestCase):

    def test_job_sample_data(self):

        for job in self.job_data:

            tj = TreeherderJob()

            tj.add_revision(job['revision'])
            tj.add_project(job['project'])
            tj.add_coalesced_guid(job['superseded'])
            tj.add_job_guid(job['job']['job_guid'])
            tj.add_job_name(job['job']['name'])
            tj.add_job_symbol(job['job']['job_symbol'])
            tj.add_group_name(job['job']['group_name'])
            tj.add_group_symbol(job['job']['group_symbol'])
            tj.add_description(job['job']['desc'])
            tj.add_product_name(job['job']['product_name'])
            tj.add_state(job['job']['state'])
            tj.add_result(job['job']['result'])
            tj.add_reason(job['job']['reason'])
            tj.add_who(job['job']['who'])
            tj.add_submit_timestamp(job['job']['submit_timestamp'])
            tj.add_start_timestamp(job['job']['start_timestamp'])
            tj.add_end_timestamp(job['job']['end_timestamp'])
            tj.add_machine(job['job']['machine'])

            tj.add_build_info(
                job['job']['build_platform']['os_name'],
                job['job']['build_platform']['platform'],
                job['job']['build_platform']['architecture']
                )

            tj.add_machine_info(
                job['job']['machine_platform']['os_name'],
                job['job']['machine_platform']['platform'],
                job['job']['machine_platform']['architecture']
                )

            tj.add_option_collection(job['job']['option_collection'])

            tj.add_log_reference(
                'builds-4h', job['job']['log_references'][0]['url'])

            # if the blob is empty, TreeherderJob will ignore the insertion
            job['job']['artifacts'][0]['blob'] = "some value"

            tj.add_artifact(
                job['job']['artifacts'][0]['name'],
                job['job']['artifacts'][0]['type'],
                job['job']['artifacts'][0]['blob'])

            self.compare_structs(tj.data, job)

            # Confirm we get the same dict if we initialize from
            # a job dict
            tj_dict = TreeherderJob(job)
            self.compare_structs(tj.data, tj_dict.data)

    def test_job_guid_validation(self):

        tj = TreeherderJob(self.job_data[0])
        tj.data['job']['job_guid'] = None

        self.assertRaises(TreeherderClientError, tj.validate)

    def test_job_data_type_validation(self):

        tj = TreeherderJob(self.job_data[0])

        # Test detection of undefined value
        tj.data['job'] = []
        self.assertRaises(TreeherderClientError, tj.validate)

        # Test detection of incorrect property type
        tj.data['job'] = ['blah', 'blah', 'blah']
        self.assertRaises(TreeherderClientError, tj.validate)

    def test_project_validation(self):

        tj = TreeherderJob(self.job_data[0])
        tj.data['project'] = None
        self.assertRaises(TreeherderClientError, tj.validate)

    def test_sample_data_validation(self):

        for job in self.job_data:
            tj = TreeherderJob(job)
            tj.validate()

    def test_bad_parse_status(self):

        tj = TreeherderJob()
        self.assertRaises(TreeherderClientError, tj.add_log_reference,
                          'foo', 'bar', 'baz')


class TreeherderClientTest(DataSetup, unittest.TestCase):
    JOB_RESULTS = [{"jobDetail1": 1},
                   {"jobDetail2": 2},
                   {"jobDetail3": 3}
                   ]
    PUSHES = [{"push1": 1},
              {"push2": 2},
              {"push3": 3}
              ]

    @responses.activate
    def test_post_job_collection(self):
        """Can add a treeherder collections to a TreeherderRequest."""
        tjc = TreeherderJobCollection()

        for job in self.job_data:
            tjc.add(tjc.get_job(job))

        client = TreeherderClient(
            server_url='http://host',
            client_id='client-abc',
            secret='secret123',
            )

        def request_callback(request):
            # Check that the expected content was POSTed.
            posted_json = json.loads(request.body)
            self.assertEqual(posted_json, tjc.get_collection_data())
            return (200, {}, '{"message": "Job successfully updated"}')

        url = client._get_endpoint_url(tjc.endpoint_base, project='project')
        responses.add_callback(responses.POST, url, match_querystring=True,
                               callback=request_callback, content_type='application/json')

        client.post_collection('project', tjc)

    def test_hawkauth_setup(self):
        """Test that HawkAuth is correctly set up from the `client_id` and `secret` params."""
        client = TreeherderClient(
            client_id='client-abc',
            secret='secret123',
            )
        auth = client.session.auth
        assert isinstance(auth, HawkAuth)
        expected_credentials = {
            'id': 'client-abc',
            'key': 'secret123',
            'algorithm': 'sha256'
        }
        self.assertEqual(auth.credentials, expected_credentials)

    @responses.activate
    def test_get_job(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.JOBS_ENDPOINT, project='mozilla-inbound')
        content = {
            "meta": {"count": 3,
                     "repository": "mozilla-inbound",
                     "offset": 0},
            "results": self.JOB_RESULTS
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
            "meta": {"count": 3, "repository": "mozilla-inbound",
                     "offset": 0},
            "results": self.PUSHES
        }
        responses.add(responses.GET, url, json=content, match_querystring=True, status=200)

        pushes = tdc.get_pushes("mozilla-inbound")
        self.assertEqual(len(pushes), 3)
        self.assertEqual(pushes, self.PUSHES)

    @responses.activate
    def test_get_results(self):
        tdc = TreeherderClient()
        url = tdc._get_endpoint_url(tdc.PUSH_ENDPOINT, project='mozilla-inbound')
        content = {
            "meta": {"count": 3, "repository": "mozilla-inbound",
                     "offset": 0},
            "results": self.PUSHES
        }
        responses.add(responses.GET, url, json=content, match_querystring=True, status=200)

        pushes = tdc.get_resultsets("mozilla-inbound")
        self.assertEqual(len(pushes), 3)
        self.assertEqual(pushes, self.PUSHES)


if __name__ == '__main__':
    unittest.main()
