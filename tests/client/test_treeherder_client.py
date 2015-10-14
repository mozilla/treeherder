from __future__ import unicode_literals

import json
import os
import unittest

import requests
from mock import patch
from requests_hawk import HawkAuth

from treeherder.client import (TreeherderArtifact,
                               TreeherderArtifactCollection,
                               TreeherderAuth,
                               TreeherderClient,
                               TreeherderClientError,
                               TreeherderJob,
                               TreeherderJobCollection,
                               TreeherderResultSet,
                               TreeherderResultSetCollection,
                               TreeherderRevision)


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
            data = f.read()
            self.job_data = json.loads(data)

        # Load sample resultsets
        self.resultset_data = []

        resultset_file = 'resultset_data.json'

        self.resultset_data_file_path = os.path.join(
            os.path.dirname(__file__),
            'data',
            resultset_file
            )

        with open(self.resultset_data_file_path) as f:
            data = f.read()
            self.resultset_data = json.loads(data)
            for resultset in self.resultset_data:
                for index, revision in enumerate(resultset['revisions']):
                    del revision['branch']

                resultset['type'] = 'push'
                resultset['author'] = 'somebody@somewhere.com'

        # Load sample artifact

        self.artifact_data = []

        artifact_file = 'artifact_data.json'

        self.artifact_data_file_path = os.path.join(
            os.path.dirname(__file__),
            'data',
            artifact_file
            )

        with open(self.artifact_data_file_path) as f:
            data = f.read()
            self.artifact_data = json.loads(data)

    def compare_structs(self, struct1, struct2):
        """Compare two dictionary structures"""

        for k1, v1 in struct1.iteritems():

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


class TreeherderResultsetTest(DataSetup, unittest.TestCase):

    def test_sample_data_validation(self):
        """Confirm that the sample data validates"""

        for resultset in self.resultset_data:

            rs = TreeherderResultSet(resultset)
            rs.validate()

            for revision in resultset['revisions']:
                tr = TreeherderRevision(revision)
                tr.validate()

    def test_resultset_sample_data(self):
        """Test all add methods for building result sets"""

        trsc = TreeherderResultSetCollection()

        for resultset in self.resultset_data:

            trs = TreeherderResultSet()

            trs.add_push_timestamp(resultset['push_timestamp'])
            trs.add_revision_hash(resultset['revision_hash'])
            trs.add_author(resultset['author'])
            trs.add_type('push')

            for revision in resultset['revisions']:

                tr = TreeherderRevision()

                tr.add_revision(revision['revision'])
                tr.add_author(revision['author'])
                tr.add_comment(revision['comment'])
                tr.add_repository(revision['repository'])

                trs.add_revision(tr)

            self.compare_structs(trs.data, resultset)

            trsc.add(trs)

            # confirm we get the same thing if we initialize from
            # a resultset dict
            trs_struct = TreeherderResultSet(resultset)

            self.compare_structs(trs_struct.data, resultset)

    def test_revision_hash_validation(self):

        trs = TreeherderResultSet(self.resultset_data[0])
        trs.data['revision_hash'] = None

        self.assertRaises(TreeherderClientError, trs.validate)

    def test_revision_hash_len_validation(self):

        trs = TreeherderResultSet(self.resultset_data[0])
        trs.data['revision_hash'] = (
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')

        self.assertRaises(TreeherderClientError, trs.validate)


class TreeherderResultSetCollectionTest(DataSetup, unittest.TestCase):

    def test_resultset_collection(self):
        """Confirm the collection matches the sample data"""
        trc = TreeherderResultSetCollection()

        for resultset in self.resultset_data:
            trs = TreeherderResultSet(resultset)
            trc.add(trs)

        self.assertTrue(len(self.resultset_data) == len(trc.data))


class TreeherderArtifactTest(DataSetup, unittest.TestCase):

    def test_sample_data_validation(self):
        """Confirm that the sample data validates"""

        for artifact in self.artifact_data:

            rs = TreeherderArtifact(artifact)
            rs.validate()

    def test_artifact_sample_data(self):
        """Test all add methods for building an artifact"""

        tac = TreeherderArtifactCollection()

        for artifact in self.artifact_data:

            ta = TreeherderArtifact()

            ta.add_blob(artifact['blob'])
            ta.add_job_guid(artifact['job_guid'])
            ta.add_name(artifact['name'])
            ta.add_type(artifact['type'])

            self.compare_structs(ta.data, artifact)

            tac.add(ta)

            # confirm we get the same thing if we initialize from
            # a resultset dict
            ta_struct = TreeherderArtifact(artifact)

            self.compare_structs(ta_struct.data, artifact)


class TreeherderArtifactCollectionTest(DataSetup, unittest.TestCase):

    def test_artifact_collection(self):
        """Confirm the collection matches the sample data"""
        tac = TreeherderArtifactCollection()

        for artifact in self.artifact_data:
            ta = TreeherderArtifact(artifact)
            tac.add(ta)

        self.assertTrue(len(self.artifact_data) == len(tac.data))

    def test_collection_chunking(self):
        tac = TreeherderArtifactCollection()

        for artifact in self.artifact_data:
            ta = TreeherderArtifact(artifact)
            tac.add(ta)

        # reconstruct the chunks and make sure we have the same data
        rebuilt_data = []
        chunk_num = 0
        for chunk in tac.get_chunks(3):
            chunk_data = chunk.get_collection_data()
            rebuilt_data.extend(chunk_data)

            chunk_num += 1
            # the last one should be the "remainder" in an uneven size
            if chunk_num == 4:
                assert len(chunk_data) == 1
            else:
                assert len(chunk_data) == 3

        assert rebuilt_data == tac.get_collection_data()

    def test_chunk_endpoint_base(self):
        """Confirm the endpoint_base of the chunks is the same as the original"""
        tac = TreeherderArtifactCollection()

        for artifact in self.artifact_data:
            ta = TreeherderArtifact(artifact)
            tac.add(ta)

        for chunk in tac.get_chunks(3):
            assert tac.endpoint_base == chunk.endpoint_base


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

            tj.add_revision_hash(job['revision_hash'])
            tj.add_project(job['project'])
            tj.add_coalesced_guid(job['coalesced'])
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
    RESULTSETS = [{"resultSet1": 1},
                  {"resultSet2": 2},
                  {"resultSet3": 3}
                  ]

    @staticmethod
    def _expected_response_return_object():
        class Mock(object):
            pass
        ret = Mock()
        setattr(ret, 'raise_for_status', lambda: None)
        return ret

    @staticmethod
    def _get_mock_response(response_struct):
        class MockResponse(object):

            def json(self):
                return response_struct

            def raise_for_status(self):
                pass

        return MockResponse()

    @patch("treeherder.client.client.requests.post")
    def test_post_job_collection(self, mock_post):
        """Can add a treeherder collections to a TreeherderRequest."""
        mock_post.return_value = self._expected_response_return_object()

        tjc = TreeherderJobCollection()

        for job in self.job_data:
            tjc.add(tjc.get_job(job))

        client = TreeherderClient(
            protocol='http',
            host='host',
            client_id='client-abc',
            secret='secret123',
            )

        client.post_collection('project', tjc)

        path, resp = mock_post.call_args

        self.assertEqual(mock_post.call_count, 1)
        self.assertEqual(
            tjc.get_collection_data(),
            resp['json']
            )

    @patch("treeherder.client.client.requests.post")
    def test_send_result_collection(self, mock_post):
        """Can add a treeherder collections to a TreeherderRequest."""
        mock_post.return_value = self._expected_response_return_object()

        trc = TreeherderResultSetCollection()

        for resultset in self.resultset_data:
            trc.add(trc.get_resultset(resultset))

        client = TreeherderClient(
            protocol='http',
            host='host',
            client_id='client-abc',
            secret='secret123',
            )

        client.post_collection('project', trc)

        path, resp = mock_post.call_args

        self.assertEqual(mock_post.call_count, 1)
        self.assertEqual(
            trc.get_collection_data(),
            resp['json']
            )

    @patch("treeherder.client.client.requests.post")
    def test_send_artifact_collection(self, mock_post):
        """Can add a artifact collections to a TreeherderRequest."""
        mock_post.return_value = self._expected_response_return_object()

        tac = TreeherderArtifactCollection()

        for artifact in self.artifact_data:
            tac.add(tac.get_artifact(artifact))

        client = TreeherderClient(
            protocol='http',
            host='host',
            client_id='client-abc',
            secret='secret123',
            )

        client.post_collection('project', tac)

        path, resp = mock_post.call_args

        self.assertEqual(mock_post.call_count, 1)
        self.assertEqual(
            tac.get_collection_data(),
            resp['json']
            )

    @patch("treeherder.client.auth.oauth.generate_nonce")
    @patch("treeherder.client.auth.oauth.time.time")
    def test_treeheder_auth(self, mock_time, mock_generate_nonce):

        """Tests that oauth data is sent to server"""
        mock_time.return_value = 1342229050
        mock_generate_nonce.return_value = "46810593"

        tjc = TreeherderJobCollection()
        tjc.add(tjc.get_job(self.job_data[0]))

        auth = TreeherderAuth('key', 'secret', 'project')
        req = requests.Request(url='http://host/api/project/project/jobs/',
                               json=tjc.get_collection_data(),
                               auth=auth, method='POST')
        prepped_request = req.prepare()
        self.assertEqual(prepped_request.url, ("http://host/api/project/project/jobs/?"
                                               "oauth_body_hash=DEn0vGleFUlmCzsFtv1fzBEpNHg%3D&"
                                               "oauth_nonce=46810593&"
                                               "oauth_timestamp=1342229050&"
                                               "oauth_consumer_key=key&"
                                               "oauth_signature_method=HMAC-SHA1&"
                                               "oauth_version=1.0&"
                                               "oauth_token=&"
                                               "user=project&"
                                               "oauth_signature=kxmsE%2BCqRDtV%2Bqk9GYeA7n4F%2FCI%3D"))

    def test_hawkauth_setup(self):
        """Test that HawkAuth is correctly set up from the `client_id` and `secret` params."""
        client = TreeherderClient(
            client_id='client-abc',
            secret='secret123',
            )
        auth = client.auth
        assert isinstance(auth, HawkAuth)
        expected_credentials = {
            'id': 'client-abc',
            'key': 'secret123',
            'algorithm': 'sha256'
        }
        self.assertEqual(auth.credentials, expected_credentials)

    @patch("treeherder.client.client.requests.get")
    def test_get_job(self, mock_get):

        mock_get.return_value = self._get_mock_response({
            "meta": {"count": 3,
                     "repository": "mozilla-inbound",
                     "offset": 0},
            "results": self.JOB_RESULTS})
        tdc = TreeherderClient()
        jobs = tdc.get_jobs("mozilla-inbound")
        self.assertEqual(len(jobs), 3)
        self.assertEqual(jobs, self.JOB_RESULTS)

    @patch("treeherder.client.client.requests.get")
    def test_get_results(self, mock_get):

        mock_get.return_value = self._get_mock_response({
            "meta": {"count": 3, "repository": "mozilla-inbound",
                     "offset": 0},
            "results": self.RESULTSETS})

        tdc = TreeherderClient()
        resultsets = tdc.get_resultsets("mozilla-inbound")
        self.assertEqual(len(resultsets), 3)
        self.assertEqual(resultsets, self.RESULTSETS)

if __name__ == '__main__':
    unittest.main()
