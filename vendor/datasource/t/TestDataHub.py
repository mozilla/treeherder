import unittest
import sys
import os

from datasource.bases.BaseHub import BaseHub
from datasource.DataHub import DataHub



class TestDataHub(unittest.TestCase):

    test_data = []

    # Set path to data file
    file_path = os.path.dirname(__file__)

    if file_path:
        data_file = file_path + '/test_data.txt'
    else:
        data_file = './test_data.txt'

    @staticmethod
    def load_data():

        data_file_obj = open(TestDataHub.data_file)
        try:
            for line in data_file_obj.read().split("\n"):
                if line:
                    TestDataHub.test_data.append(line.split("\t"))
        finally:
            data_file_obj.close()

        TestDataHub.test_data_rows = len(TestDataHub.test_data)

    @staticmethod
    def getSuite():
        """
        The order of the tests is critical.  Build a test suite that insures
        proper execution order.

        Parameters:
           None

        Returns:
           test suite
        """
        tests = ['test_parse_data_sources',
                 'test_db_existence',
                 'test_create_data_table',
                 'test_load_data',
                 'test_drop_table',
                 ]

        return unittest.TestSuite(map(TestDataHub, tests))

    def setUp(self):

        ####
        #TODO:
        #Most of the attribute initializations would be better placed
        #in __init__.  However, I get a doc string related error when
        #I try that from the base class, not sure why.  Skipping for now.
        ###
        self.test_data_rows = 0
        self.data_source = 'MySQL_test'
        self.db = 'test'
        self.table_name = 'DATA_SOURCES_TEST_DATA'
        self.callback_calls = 0
        self.limit = 100
        self.columns = set(['category', 'term', 'go_id', 'id', 'auto_pfamA'])

    def tearDown(self):
        sys.stdout.flush()

    def test_parse_data_sources(self):

        ##Instantiating base hub triggers data_sources.json parsing##
        bh = BaseHub()
        if self.data_source not in BaseHub.data_sources:
            msg = "The required data source, %s, was not found in %s" % (self.data_source, BaseHub.source_list_file)
            fail(msg)

    def test_db_existence(self):

        dh = DataHub.get(self.data_source)
        dbs = dh.get_databases()

        if 'test' not in dbs:
            msg = "No 'test' database found in %s.  To run this method create a 'test' db in %s." % (self.data_source, self.data_source)
            self.fail(msg)

    def test_create_data_table(self):

        dh = DataHub.get(self.data_source)
        dh.execute(db=self.db,
                   proc="test.create_table")

        table_set = dh.execute(db=self.db,
                             proc="sql.ds_selects.get_tables",
                             key_column="Tables_in_test",
                             return_type="set")

        if self.table_name not in table_set:
            msg = "The table, %s, was not created in %s." % (self.table_name, self.db)
            self.fail(msg)

    def test_load_data(self):

        dh = DataHub.get(self.data_source)
        dh.use_database('test')

        ##Load Data##
        for row in TestDataHub.test_data:
            dh.execute(proc="test.insert_test_data",
                       placeholders=row)

        rowcount = dh.execute( db=self.db,
                            proc="sql.ds_selects.get_row_count",
                            replace=['auto_pfamA', self.table_name],
                            return_type='iter').get_column_data('rowcount')

        ##Confirm we loaded all of the rows##
        msg = 'Row count in data file, %i, does not match row count in db %i.' % (TestDataHub.test_data_rows, rowcount)
        self.assertEqual(rowcount, TestDataHub.test_data_rows, msg=msg)

    def test_drop_table(self):

        dh = DataHub.get(self.data_source)
        dh.execute(db=self.db,
                   proc="test.drop_table")

        table_set = dh.execute(db=self.db,
                             proc="sql.ds_selects.get_tables",
                             key_column="Tables_in_test",
                             return_type="set")

        if self.table_name in table_set:
            msg = "The table, %s, was not dropped in %s." % (self.table_name, self.db)
            self.fail(msg)



def main():
    ##Load test data one time##
    TestDataHub.load_data()

    suite = TestDataHub.getSuite()
    unittest.TextTestRunner(verbosity=2).run(suite)

if __name__ == '__main__':
    main()
