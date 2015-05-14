# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import unicode_literals

import unittest
import os
import json

from mock import patch

from treeherder.client import (TreeherderJob, TreeherderJobCollection,
                               TreeherderRevision, TreeherderResultSet,
                               TreeherderResultSetCollection,
                               TreeherderClientError, TreeherderRequest,
                               TreeherderArtifact,
                               TreeherderArtifactCollection)


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

                # Add artifacts to data
                resultset['artifact'] = {
                    u'name': 'push_data',
                    u'type': 'push',
                    u'blob': {u'stuff': [1, 2, 3, 4, 5]}
                    }

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
            trs.add_artifact('push_data', 'push', {'stuff': [1, 2, 3, 4, 5]})

            for revision in resultset['revisions']:

                tr = TreeherderRevision()

                tr.add_revision(revision['revision'])
                tr.add_author(revision['author'])
                tr.add_comment(revision['comment'])
                tr.add_files(revision['files'])
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

        chunks = tac.get_chunks(3)
        self.assertTrue(len(chunks) == 4)
        self.assertTrue(len(chunks[0].get_collection_data()) == 3)
        self.assertTrue(len(chunks[1].get_collection_data()) == 3)
        self.assertTrue(len(chunks[2].get_collection_data()) == 3)
        self.assertTrue(len(chunks[3].get_collection_data()) == 1)

        # now put it back together and make sure we have the same data
        rebuilt_data = []
        for chunk in chunks:
            rebuilt_data.extend(chunk.get_collection_data())

        assert rebuilt_data == tac.get_collection_data()


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

        tjc_update = TreeherderJobCollection(job_type='update')

        self.assertTrue(tjc.endpoint_base, 'objectstore')
        self.assertTrue(tjc_update.endpoint_base, 'jobs')


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
            tj.add_build_url(job['job']['build_url'])

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


class TreeherderRequestTest(DataSetup, unittest.TestCase):

    @patch.object(TreeherderRequest, 'send')
    def test_send_job_collection(self, mock_send):
        """Can add a treeherder collections to a TreeherderRequest."""

        tjc = TreeherderJobCollection()

        for job in self.job_data:

            tjc.add(tjc.get_job(job))

        req = TreeherderRequest(
            protocol='http',
            host='host',
            project='project',
            oauth_key='key',
            oauth_secret='secret',
            )

        req.post(tjc)

        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(
            tjc.to_json(),
            mock_send.call_args_list[0][1]['data']
            )

    @patch.object(TreeherderRequest, 'send')
    def test_send_result_collection(self, mock_send):
        """Can add a treeherder collections to a TreeherderRequest."""

        trc = TreeherderResultSetCollection()

        for resultset in self.resultset_data:

            trc.add(trc.get_resultset(resultset))

        req = TreeherderRequest(
            protocol='http',
            host='host',
            project='project',
            oauth_key='key',
            oauth_secret='secret',
            )

        req.post(trc)

        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(
            trc.to_json(),
            mock_send.call_args_list[0][1]['data']
            )

    @patch.object(TreeherderRequest, 'send')
    def test_send_artifact_collection(self, mock_send):
        """Can add a artifact collections to a TreeherderRequest."""

        tac = TreeherderArtifactCollection()

        for artifact in self.artifact_data:

            tac.add(tac.get_artifact(artifact))

        req = TreeherderRequest(
            protocol='http',
            host='host',
            project='project',
            oauth_key='key',
            oauth_secret='secret',
        )

        req.post(tac)

        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(
            tac.to_json(),
            mock_send.call_args_list[0][1]["data"]
        )

    @patch("treeherder.client.client.oauth.generate_nonce")
    @patch("treeherder.client.client.oauth.time.time")
    @patch("treeherder.client.client.requests.post")
    def test_send(self, mock_post, mock_time, mock_generate_nonce):

        """Can send data to the server."""
        mock_time.return_value = 1342229050
        mock_generate_nonce.return_value = "46810593"

        host = 'host'

        req = TreeherderRequest(
            protocol='http',
            host=host,
            project='project',
            oauth_key='key',
            oauth_secret='secret',
            )

        mock_response = mock_post.return_value

        tjc = TreeherderJobCollection()

        tjc.add(tjc.get_job(self.job_data[0]))

        response = req.post(tjc)

        self.assertEqual(mock_response, response)
        self.assertEqual(mock_post.call_count, 1)

        path, resp = mock_post.call_args

        deserialized_data = json.loads(resp['data'])
        self.assertEqual(
            deserialized_data,
            tjc.get_collection_data()
            )
        self.assertEqual(
            resp['headers']['Content-Type'],
            'application/json',
            )

    @patch("treeherder.client.client.oauth.generate_nonce")
    @patch("treeherder.client.client.oauth.time.time")
    @patch("treeherder.client.client.requests.post")
    def test_send_without_oauth(self, mock_post, mock_time,
                                mock_generate_nonce):

        """Can send data to the server."""
        mock_time.return_value = 1342229050
        mock_generate_nonce.return_value = "46810593"

        host = 'host'

        req = TreeherderRequest(
            protocol='http',
            host=host,
            project='project',
            oauth_key=None,
            oauth_secret=None,
            )

        mock_response = mock_post.return_value

        tjc = TreeherderJobCollection()

        for job in self.job_data:

            tjc.add(tjc.get_job(job))
            break

        response = req.post(tjc)

        self.assertEqual(mock_response, response)
        self.assertEqual(mock_post.call_count, 1)

        path, resp = mock_post.call_args

        deserialized_data = json.loads(resp['data'])
        self.assertEqual(
            deserialized_data,
            tjc.get_collection_data()
            )
        self.assertEqual(
            resp['headers']['Content-Type'],
            'application/json',
            )

if __name__ == '__main__':
    unittest.main()
