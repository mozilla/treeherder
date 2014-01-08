import unittest
import os
from mock import patch

from thclient import (TreeherderJob, TreeherderJobCollection,
    TreeherderRevision, TreeherderResultSet, TreeherderResultSetCollection,
    TreeherderClientError, TreeherderRequest)

try:
    import json
except ImportError:
    import simplejson as json

class DataSetup(unittest.TestCase):

    def setUp(self):

        # Load sample job data
        self.job_data = []

        job_data_file = 'job_data.json'

        self.job_data_file_path = os.path.join(
            'thclient', 'tests', 'data', job_data_file
            )

        with open(self.job_data_file_path) as f:
            data = f.read()
            self.job_data = json.loads(data)

        # Load sample resultsets
        self.resultset_data = []

        resultset_file = 'resultset_data.json'

        self.resultset_data_file_path = os.path.join(
            'thclient', 'tests', 'data', resultset_file
            )

        with open(self.resultset_data_file_path) as f:
            data = f.read()
            self.resultset_data = json.loads(data)
            for resultset in self.resultset_data:
                for index, revision in enumerate(resultset['revisions']):
                    del revision['branch']

                resultset['artifact'] = {
                    u'name':'push_data',
                    u'type':'push',
                    u'blob': { u'stuff':[1,2,3,4,5] }
                    }

                resultset['type'] = 'push'

        # Sample post response with oauth credentials
        post_file = 'post.txt'
        self.post_file_path = os.path.join(
            'thclient', 'tests', 'data', post_file
            )
        with open(self.post_file_path) as f:
            self.post_data = f.read().strip()

        # Sample post response with no oauth credentials
        no_oauth_post_file = 'no_oauth_post.txt'
        self.no_oauth_post_file_path = os.path.join(
            'thclient', 'tests', 'data', no_oauth_post_file
            )
        with open(self.no_oauth_post_file_path) as f:
            self.no_oauth_post_data = f.read().strip()

    def compare_structs(self, struct1, struct2):
        """Compare two dictionary structures"""

        for k1, v1 in struct1.iteritems():

            self.assertTrue(
                k1 in struct2,
                'struct1 key, {0}, not found in struct2'.format(k1) )

            if isinstance(v1, dict):

                self.assertTrue(
                    isinstance(struct2[k1], dict),
                    'struct2 value not a dict for key {0}'.format(k1) )

                # recursively iterate through any dicts found
                self.compare_structs(v1, struct2[k1])

            elif isinstance(v1, list):

                self.assertTrue(
                    isinstance(struct2[k1], list),
                    'struct2 not a list for key {0}'.format(k1) )

                self.assertEqual(
                    v1, struct2[k1],
                    ('struct1 and struct2 not equal for key {0}\n'
                     'struct1[{0}] = {1}\n'
                     'struct2[{0}] = {2}\n').format(k1, v1, struct2[k1])
                    )

            else:
                self.assertEqual(
                    v1, struct2[k1],
                    'struct1[{0}], {1} != struct2[{0}], {2}'.format(k1, v1, struct2[k1])
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

            trs.add_push_timestamp( resultset['push_timestamp'] )
            trs.add_revision_hash( resultset['revision_hash'] )
            trs.add_type( 'push' )
            trs.add_artifact( 'push_data', 'push', { 'stuff':[1,2,3,4,5] } )

            for revision in resultset['revisions']:

                tr = TreeherderRevision()

                tr.add_revision( revision['revision'] )
                tr.add_author( revision['author'] )
                tr.add_comment( revision['comment'] )
                tr.add_files( revision['files'] )
                tr.add_repository( revision['repository'] )

                trs.add_revision(tr)

            self.compare_structs(trs.data, resultset)

            trsc.add(trs)

            # confirm we get the same thing if we initialize from
            # a resultset dict
            trs_struct = TreeherderResultSet(resultset)

            self.compare_structs(trs_struct.data, resultset)

class TreeherderResultSetCollectionTest(DataSetup, unittest.TestCase):

    def test_resultset_collection(self):
        """Confirm the collection matches the sample data"""
        trc = TreeherderResultSetCollection()

        for resultset in self.resultset_data:
            trs = TreeherderResultSet(resultset)
            trc.add(trs)

        self.assertTrue( len(self.resultset_data) == len(trc.data) )

class TreeherderJobCollectionTest(DataSetup, unittest.TestCase):

    def test_job_collection(self):
        """Confirm the collection matches the sample data"""
        tjc = TreeherderJobCollection()

        for job in self.job_data:
            tj = TreeherderJob(job)
            tjc.add(tj)

        self.assertTrue( len(self.job_data) == len(tjc.data) )

class TreeherderJobTest(DataSetup, unittest.TestCase):

    def test_job_sample_data(self):

        for job in self.job_data:

            tj = TreeherderJob()

            tj.add_revision_hash( job['revision_hash'] )
            tj.add_project( job['project'] )
            tj.add_coalesced_guid( job['coalesced'] )
            tj.add_job_guid( job['job']['job_guid'] )
            tj.add_job_name( job['job']['name'] )
            tj.add_job_symbol( job['job']['job_symbol'] )
            tj.add_group_name( job['job']['group_name'] )
            tj.add_group_symbol( job['job']['group_symbol'] )
            tj.add_description( job['job']['desc'] )
            tj.add_product_name( job['job']['product_name'] )
            tj.add_state( job['job']['state'] )
            tj.add_result( job['job']['result'] )
            tj.add_reason( job['job']['reason'] )
            tj.add_who( job['job']['who'] )
            tj.add_submit_timestamp( job['job']['submit_timestamp'] )
            tj.add_start_timestamp( job['job']['start_timestamp'] )
            tj.add_end_timestamp( job['job']['end_timestamp'] )
            tj.add_machine( job['job']['machine'] )
            tj.add_build_url( job['job']['build_url'] )

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

            tj.add_option_collection( job['job']['option_collection'] )

            tj.add_log_reference(
                'builds-4h', job['job']['log_references'][0]['url'] )

            tj.add_artifact(
                job['job']['artifact']['name'],
                job['job']['artifact']['type'],
                job['job']['artifact']['blob'] )

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

class TreeherderRequestTest(DataSetup, unittest.TestCase):

    @patch.object(TreeherderRequest, 'send')
    def test_send_job_collection(self, mock_send):
        """Can add a treeherder collections to a TreeherderRequest."""

        tjc = TreeherderJobCollection()

        for job in self.job_data:

            tjc.add( tjc.get_job(job) )

        req = TreeherderRequest(
            protocol='http',
            host='host',
            project='project',
            oauth_key='key',
            oauth_secret='secret',
            )

        req.send(tjc)

        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(
            tjc.data,
            mock_send.call_args_list[0][0][0].data
            )

    @patch.object(TreeherderRequest, 'send')
    def test_send_result_collection(self, mock_send):
        """Can add a treeherder collections to a TreeherderRequest."""

        trc = TreeherderResultSetCollection()

        for resultset in self.resultset_data:

            trc.add( trc.get_resultset(resultset) )

        req = TreeherderRequest(
            protocol='http',
            host='host',
            project='project',
            oauth_key='key',
            oauth_secret='secret',
            )

        req.send(trc)

        self.assertEqual(mock_send.call_count, 1)
        self.assertEqual(
            trc.data,
            mock_send.call_args_list[0][0][0].data
            )

    @patch("thclient.client.oauth.generate_nonce")
    @patch("thclient.client.oauth.time.time")
    @patch("thclient.client.httplib.HTTPConnection")
    def test_send(
        self, mock_HTTPConnection, mock_time, mock_generate_nonce):

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

        mock_conn = mock_HTTPConnection.return_value
        mock_request = mock_conn.request
        mock_response = mock_conn.getresponse.return_value

        tjc = TreeherderJobCollection()

        for job in self.job_data:

            tjc.add( tjc.get_job(job) )
            break

        response = req.send(tjc)


        self.assertEqual(mock_HTTPConnection.call_count, 1)
        self.assertEqual(mock_HTTPConnection.call_args[0][0], host)
        self.assertEqual(mock_response, response)
        self.assertEqual(mock_request.call_count, 1)

        uri = req.get_uri(tjc)

        method, path, data, header = mock_request.call_args[0]
        self.assertEqual(method, "POST")
        self.assertEqual(path, uri)

        self.assertEqual(data, self.post_data)

        self.assertEqual(
            header['Content-type'],
            'application/json',
            )

        self.assertEqual(data, self.post_data)

    @patch("thclient.client.oauth.generate_nonce")
    @patch("thclient.client.oauth.time.time")
    @patch("thclient.client.httplib.HTTPConnection")
    def test_send_without_oauth(
        self, mock_HTTPConnection, mock_time, mock_generate_nonce):

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

        mock_conn = mock_HTTPConnection.return_value
        mock_request = mock_conn.request
        mock_response = mock_conn.getresponse.return_value

        tjc = TreeherderJobCollection()

        for job in self.job_data:

            tjc.add( tjc.get_job(job) )
            break

        response = req.send(tjc)

        self.assertEqual(mock_HTTPConnection.call_count, 1)
        self.assertEqual(mock_HTTPConnection.call_args[0][0], host)
        self.assertEqual(mock_response, response)
        self.assertEqual(mock_request.call_count, 1)

        uri = req.get_uri(tjc)

        method, path, data, header = mock_request.call_args[0]
        self.assertEqual(method, "POST")
        self.assertEqual(path, uri)

        self.assertEqual(data, self.no_oauth_post_data)

        self.assertEqual(
            header['Content-type'],
            'application/json',
            )

if __name__ == '__main__':
    unittest.main()
