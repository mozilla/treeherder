import unittest
import sys
import os
import json

from datasource.bases.BaseHub import BaseHub
from datasource.bases.RDBSHub import RDBSHub, RDBSHubExecuteError

from datasource.hubs.MySQL import MySQL


class TestMySQLHub(unittest.TestCase):

    test_data = []

    ##Set path to data file##
    file_path = os.path.dirname(__file__)

    if file_path:
        data_file = file_path + '/test_data.txt'
        character_encode_file = file_path + '/character_encoding_data.txt'
    else:
        data_file = './test_data.txt'
        character_encode_file = './character_encoding_data.txt'


    @staticmethod
    def load_data():

        data_file_obj = open(TestMySQLHub.data_file)
        try:
            for line in data_file_obj.read().split("\n"):
                if line:
                    TestMySQLHub.test_data.append(line.split("\t"))
        finally:
            data_file_obj.close()

        TestMySQLHub.test_data_rows = len(TestMySQLHub.test_data)


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
                 'test_execute_rules',
                 'test_create_data_table',
                 'test_load_data',
                 'test_iter_return_type',
                 'test_dict_return_type',
                 'test_dict_json_return_type',
                 'test_tuple_return_type',
                 'test_tuple_json_return_type',
                 'test_set_return_type',
                 'test_set_json_return_type',
                 'test_table_return_type',
                 'test_table_json_return_type',
                 'test_callback_return_type',
                 'test_chunking',
                 'test_chunking_with_min',
                 'test_chunking_with_records',
                 'test_raw_sql',
                 'test_replace',
                 'test_replace_quote',
                 'test_placeholder_quote',
                 'test_big_replace',
                 'test_executemany',
                 'test_nocommit',
                 'test_rollback',
                 'test_drop_table',
                 'test_exception_on_debug',
                 'test_encoding'
                 ]

        return unittest.TestSuite(map(TestMySQLHub, tests))


    def setUp(self):
        self.test_data_rows = 0
        self.data_source = 'MySQL_test'
        self.db = 'test'
        self.table_name = 'DATA_SOURCES_TEST_DATA'
        self.callback_calls = 0
        self.limit = 100
        self.columns = set(['category', 'term', 'go_id', 'id', 'auto_pfamA'])
        self.dh = MySQL(self.data_source)


    def tearDown(self):
        self.dh.disconnect()
        sys.stdout.flush()


    def test_parse_data_sources(self):
        if self.data_source not in BaseHub.data_sources:
            msg = "The required data source, %s, was not found in %s" % (self.data_source, BaseHub.source_list_file)
            self.fail(msg)


    def test_db_existence(self):
        dbs = self.dh.get_databases()

        if 'test' not in dbs:
            msg = "No 'test' database found in %s.  To run this method create a 'test' db in %s." % (self.data_source, self.data_source)
            self.fail(msg)


    def test_execute_rules(self):

        rh = RDBSHub(self.data_source)

        ###
        #See RDBSHub.set_execute_rules for test descriptions
        ###

        #########
        #All tests should raise RDBSHubExecuteError
        #########

        # 1.) make sure we recognize all of the args, chicken being the exception here
        args = dict(chicken=1, proc='fake.proc', return_type='tuple')
        self.__try_it(rh, args)

        # 2.) proc or sql must be provided or we have nothing to execute
        args = dict(return_type='tuple', db=self.db)
        self.__try_it(rh, args)

        # 3.) placeholders and replace must be set to lists
        args = dict(placeholders=dict())
        self.__try_it(rh, args)
        args = dict(replace=dict())
        self.__try_it(rh, args)

        # 4.) key_column is required if the return type is dict, dict_json,
        # set, or set_json
        for key in rh.return_type_key_columns:
            args = dict(return_type=key, proc='fake.proc')
            self.__try_it(rh, args)

        # 5.) If a return type of callback is selected a callback key must be
        # provided wih a function reference
        args = dict(return_type='callback', proc='fake.proc')
        self.__try_it(rh, args)

        # 6.) chunk_size must be provided with a chunk_source
        args = dict(chunk_size=100, proc='fake.proc')
        self.__try_it(rh, args)
        args = dict(chunk_source='table.column', proc='fake.proc')
        self.__try_it(rh, args)


    def test_create_data_table(self):

        self.dh.execute(
            db=self.db,
            proc="test.create_table",
            )

        table_set = self.dh.execute(
            db=self.db,
            proc="sql.ds_selects.get_tables",
            key_column="Tables_in_test",
            return_type="set",
            )

        if self.table_name not in table_set:
            msg = "The table, %s, was not created in %s." % (
                self.table_name, self.db)
            self.fail(msg)


    def test_load_data(self):
        self.dh.use_database('test')

        ##Load Data##
        for row in TestMySQLHub.test_data:
            self.dh.execute(
                proc="test.insert_test_data",
                placeholders=row,
                )

        rowcount = self.dh.execute(
            db=self.db,
            proc="sql.ds_selects.get_row_count",
            replace=['auto_pfamA', self.table_name],
            return_type='iter',
            ).get_column_data('rowcount')

        ##Confirm we loaded all of the rows##
        msg = 'Row count in data file, %i, does not match row count in db %i.' % (TestMySQLHub.test_data_rows, rowcount)
        self.assertEqual(rowcount, TestMySQLHub.test_data_rows, msg=msg)


    def test_table_iter(self):
        iter = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            return_type='iter',
            )

        msg = 'Row count in iter, %i, does not match row count in db %i.' % (
            iter.rowcount, TestMySQLHub.test_data_rows)
        self.assertEqual(iter.rowcount, TestMySQLHub.test_data_rows, msg=msg)

        rowcount = 0
        for data in iter:
            rowcount += 1

        msg = 'The iterations in iter, %i, do not match the row count in db %i.' % (rowcount, TestMySQLHub.test_data_rows)
        self.assertEqual(iter.rowcount, TestMySQLHub.test_data_rows, msg=msg)


    def test_iter_return_type(self):
        iter = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=self.limit,
            return_type='iter',
            )

        rowcount = 0
        columns = set()
        for row in iter:
            if rowcount == 0:
                map(lambda c:columns.add(c), row.keys())
            rowcount += 1

        msg = 'The iter.rowcount, %i, do not match the row count %i.' % (iter.rowcount, self.limit)
        self.assertEqual(iter.rowcount, self.limit, msg=msg)

        msg = 'The iterations in iter, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)

        msg = 'The column names in iter, %s, do not match %s.' % (','.join(columns), ','.join(self.columns))
        self.assertEqual(columns, self.columns)

        iter = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=1,
            return_type='iter',
            )

        term = iter.get_column_data('term')
        if not term:
            msg = 'iter.get_column_data failed to retrieve `term` column.'
            self.fail(msg)


    def test_dict_return_type(self):
        data = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=self.limit,
            key_column='id',
            return_type='dict',
            )

        rowcount = len(data)
        columns = set(data[1].keys())

        msg = 'return value must be a dict'
        self.assertEqual(type(data), type(dict()), msg=msg)

        msg = 'The items in data dictionary, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)

        msg = 'The column names in data dictionary, %s, do not match %s.' % (','.join(columns), ','.join(self.columns))
        self.assertEqual(columns, self.columns)


    def test_dict_json_return_type(self):
        j = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=self.limit,
            key_column='id',
            return_type='dict_json',
            )

        data = json.loads(j)
        rowcount = len(data)

        ##Keys will be unicode since it's coming from json##
        columns = set(data[u'1'].keys())

        msg = 'The items in data dictionary, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)

        msg = 'The column names in data dictionary, %s, do not match %s.' % (','.join(columns), ','.join(self.columns))
        self.assertEqual(columns, self.columns)


    def test_tuple_return_type(self):
        data = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=self.limit,
            return_type='tuple',
            )

        rowcount = len(data)
        columns = set(data[0].keys())

        msg = 'return value must be a tuple'
        self.assertEqual(type(data), type(tuple()), msg=msg)

        msg = 'The items in data tuple, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)

        msg = 'The column names in data tuple, %s, do not match %s.' % (','.join(columns), ','.join(self.columns))
        self.assertEqual(columns, self.columns)


    def test_tuple_json_return_type(self):
        j = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=self.limit,
            return_type='tuple_json',
            )

        data = json.loads(j)

        rowcount = len(data)
        columns = set(data[0].keys())

        msg = 'The items in data tuple, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)

        msg = 'The column names in data tuple, %s, do not match %s.' % (','.join(columns), ','.join(self.columns))
        self.assertEqual(columns, self.columns)


    def test_set_return_type(self):
        data = self.dh.execute( db=self.db,
                           proc="test.get_data",
                           limit=self.limit,
                           key_column='id',
                           return_type='set')

        msg = 'return value must be a set'
        self.assertEqual(type(data), type(set()), msg=msg)

        rowcount = len(data)

        msg = 'The items in data set, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)


    def test_set_json_return_type(self):
        j = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=self.limit,
            key_column='id',
            return_type='set_json',
            )

        data = json.loads(j)
        rowcount = len(data)

        msg = 'The items in data set, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)


    def test_table_return_type(self):
        data = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=self.limit,
            return_type='table',
            )

        if 'columns' not in data:
            msg = "The columns key was not found in data."
            self.fail(msg)
        if 'data' not in data:
            msg = "The data key was not found in data."
            self.fail(msg)

        rowcount = len( data['data'] )

        msg = 'The items in data set, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)


    def test_table_json_return_type(self):
        j = self.dh.execute(
            db=self.db,
            proc="test.get_data",
            limit=self.limit,
            return_type='table_json',
            )

        data = json.loads(j)

        if 'columns' not in data:
            msg = "The columns key was not found in data."
            self.fail(msg)
        if 'data' not in data:
            msg = "The data key was not found in data."
            self.fail(msg)

        rowcount = len( data['data'] )

        msg = 'The items in data set, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)


    def test_callback_return_type(self):
        self.dh.execute(
            db=self.db,
            proc="test.get_data",
            callback=self.__callback_test,
            limit=self.limit,
            return_type='callback',
            )

        msg = 'self.callback_calls, %i, does not match the row count %i.' % (self.callback_calls, self.limit)
        self.assertEqual(self.callback_calls, self.limit, msg=msg)


    def test_chunking(self):
        chunk_size = 10
        nsets = 0
        for d in self.dh.execute(
            db=self.db,
            proc="test.get_data",
            chunk_size=chunk_size,
            chunk_source='DATA_SOURCES_TEST_DATA.id',
            ):

            nsets += 1

        msg = 'total chunk sets should be, %i, there were %i chunk sets found.' % (986, nsets)
        self.assertEqual(986, nsets, msg=msg)


    def test_chunking_with_min(self):
        chunk_size = 100

        nsets = 0
        for d in self.dh.execute(
            db=self.db,
            proc="test.get_data",
            chunk_size=chunk_size,
            chunk_min=5,
            chunk_source='DATA_SOURCES_TEST_DATA.id',
            ):

            nsets += 1

        msg = 'total chunk sets should be, %i, there were %i chunk sets found.' % (99, nsets)
        self.assertEqual(99, nsets, msg=msg)


    def test_chunking_with_records(self):
        chunk_size = 5
        nsets = 0
        for d in self.dh.execute(
            db=self.db,
            proc="test.get_data",
            chunk_size=chunk_size,
            chunk_total=50,
            chunk_source='DATA_SOURCES_TEST_DATA.id',
            ):

            nsets += 1

        msg = 'total chunk sets should be, %i, there were %i chunk sets found.' % (10, nsets)
        self.assertEqual(10, nsets, msg=msg)


    def test_raw_sql(self):

        sql = """SELECT `id`, `auto_pfamA`, `go_id`, `term`, `category`
                 FROM `test`.`DATA_SOURCES_TEST_DATA`"""

        data = self.dh.execute(
            db=self.db,
            sql=sql,
            limit=self.limit,
            return_type='tuple',
            )

        rowcount = len(data)
        columns = set(data[0].keys())

        msg = 'The items in data tuple, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)

        msg = 'The column names in data tuple, %s, do not match %s.' % (','.join(columns), ','.join(self.columns))
        self.assertEqual(columns, self.columns)


    def test_replace(self):

        rep_values = ['id',
                     'auto_pfamA',
                     'go_id',
                     'term',
                     'category',
                     'DATA_SOURCES_TEST_DATA']

        data = self.dh.execute(
            db=self.db,
            proc="test.get_data_replace",
            limit=self.limit,
            replace=rep_values,
            return_type='tuple',
            )

        rowcount = len(data)

        msg = 'The items in data tuple, %i, do not match the row count %i.' % (rowcount, self.limit)
        self.assertEqual(rowcount, self.limit, msg=msg)


    def test_replace_quote(self):

        rep_values = [ "GO:0015075",
                       "GO:0032934",
                       "GO:0003700",
                       "GO:0000795" ]

        data = self.dh.execute(
            db=self.db,
            proc="test.get_replace_quote",
            replace_quote=[rep_values],
            return_type='tuple',
            )

        rows = 90
        rowcount = len(data)

        msg = 'The items in data tuple, %i, do not match the row count %i.' % (rowcount, rows)
        self.assertEqual(rowcount, rows, msg=msg)


    def test_placeholder_quote(self):

        p = [ "GO:0015075",
              "GO:0032934",
              "GO:0003700",
              "GO:0000795" ]

        data = self.dh.execute(
            db=self.db,
            proc="test.get_placeholder_quote",
            placeholders=p,
            return_type='tuple',
            )

        rows = 90
        rowcount = len(data)

        msg = 'The items in data tuple, %i, do not match the row count %i.' % (rowcount, rows)
        self.assertEqual(rowcount, rows, msg=msg)


    def test_big_replace(self):

        ids = [1,2,3,4,5,6,7,8,9,10]

        rep_values = ['id',
                     'auto_pfamA',
                     'go_id',
                     'term',
                     'category',
                     'DATA_SOURCES_TEST_DATA',
                     ids]

        self.dh.execute(
            db=self.db,
            proc="test.get_big_replace",
            limit=self.limit,
            replace=rep_values,
            return_type='tuple',
            )


    def test_executemany(self):
        self.dh.use_database('test')

        ##Load Data##
        placeholders = []
        for row in TestMySQLHub.test_data:
            placeholders.append( row )

        self.dh.execute(
            proc="test.insert_test_data",
            executemany=True,
            placeholders=placeholders,
            )

        rowcount = self.dh.execute(
            db=self.db,
            proc="sql.ds_selects.get_row_count",
            replace=['auto_pfamA', self.table_name],
            return_type='iter',
            ).get_column_data('rowcount')

        ##Confirm we loaded all of the rows##
        target_rowcount = 2*TestMySQLHub.test_data_rows
        msg = 'Row count in data file, %i, does not match row count in db %i.' % (target_rowcount, rowcount)
        self.assertEqual(rowcount, target_rowcount, msg=msg)


    def test_nocommit(self):
        self.dh.use_database('test')

        # MySQL connection exclusively for reads
        dh_read = MySQL(self.data_source)
        dh_read.use_database('test')

        rowcount_before = dh_read.execute(
            db=self.db,
            proc="sql.ds_selects.get_row_count",
            nocommit=True,
            replace=['auto_pfamA', self.table_name],
            return_type='iter',
            ).get_column_data('rowcount')

        # Load Data
        for row in TestMySQLHub.test_data:
            self.dh.execute(
                proc="test.insert_test_data",
                nocommit=True,
                placeholders=row,
                )

        # Need to make a new connection for each read to accurately obtain the
        # current row count (because of MySQL's default, repeatable-read)
        dh_read.disconnect()
        dh_read = MySQL(self.data_source)
        dh_read.use_database('test')
        rowcount_after = dh_read.execute(
            db=self.db,
            proc="sql.ds_selects.get_row_count",
            nocommit=True,
            replace=['auto_pfamA', self.table_name],
            return_type='iter',
            ).get_column_data('rowcount')

        # Confirm we loaded all of the rows
        msg = 'Data was committed even though nocommit was set.'
        self.assertEqual(rowcount_before, rowcount_after, msg=msg)

        # Call the SQLHub commit function
        self.dh.commit('master_host')

        # New connection
        dh_read.disconnect()
        dh_read = MySQL(self.data_source)
        dh_read.use_database('test')
        rowcount_after_commit = dh_read.execute(
            db=self.db,
            proc="sql.ds_selects.get_row_count",
            nocommit=True,
            replace=['auto_pfamA', self.table_name],
            return_type='iter',
            ).get_column_data('rowcount')

        # Confirm the transaction was actually committed
        msg = 'Data was not committed despite calling commit.'
        self.assertNotEqual(rowcount_before, rowcount_after_commit, msg=msg)

        dh_read.disconnect()

    def test_rollback(self):
        dh_read = MySQL(self.data_source)
        dh_read.use_database('test')

        rowcount_before = dh_read.execute(
            db=self.db,
            proc="sql.ds_selects.get_row_count",
            nocommit=True,
            replace=['auto_pfamA', self.table_name],
            return_type='iter',
            ).get_column_data('rowcount')

        self.dh.execute(db=self.db, nocommit=True, proc="test.insert_dummy_row")
        self.dh.rollback('master_host')
        self.dh.commit('master_host')

        dh_read.disconnect()
        dh_read = MySQL(self.data_source)
        dh_read.use_database('test')

        rowcount_after = dh_read.execute(
            db=self.db,
            proc="sql.ds_selects.get_row_count",
            nocommit=True,
            replace=['auto_pfamA', self.table_name],
            return_type='iter',
            ).get_column_data('rowcount')

        dh_read.disconnect()

        msg = "A row was inserted despite rollback."
        self.assertEqual(rowcount_before, rowcount_after, msg=msg)

    def test_drop_table(self):
        self.dh.execute(db=self.db, proc="test.drop_table")

        table_set = self.dh.execute(
            db=self.db,
            proc="sql.ds_selects.get_tables",
            key_column="Tables_in_test",
            return_type="set",
            )

        if self.table_name in table_set:
            msg = "The table, %s, was not dropped in %s." % (self.table_name, self.db)
            self.fail(msg)


    def test_exception_on_debug(self):
        from MySQLdb import ProgrammingError

        try:
            self.dh.execute(
                sql="SELECT giant_nebula FROM universe",
                debug_show=True,
                )
            self.fail("expect an exception.")
        except ProgrammingError:
            self.assertTrue(True, "expect an exception.")

    def test_encoding(self):

        data = ''
        with open(TestMySQLHub.character_encode_file) as f:
            data = unicode( f.read().decode("utf-8") )

        self.dh.execute(
            db=self.db,
            proc="test.create_encode_test_table",
            )

        self.dh.execute(
            db=self.db,
            proc="test.insert_encode_data",
            replace_quote=[data]
            )
        self.dh.execute(
            db=self.db,
            proc="test.get_encode_data",
            return_type='tuple'
            )
        self.dh.execute(
            db=self.db,
            proc="test.drop_encode_table",
            )

    def __callback_test(self, row):
        self.callback_calls += 1


    def __try_it(self, rh, args):
        try:
            rh.set_execute_rules(args)
        except RDBSHubExecuteError:
            ##Yay! test worked
            pass
        else:
            ##OOh we should have an error here##
            self.fail("\tShould have raised RDBSHubExecuteError on args:%s" % (','.join(args.keys())))



def main():
    ##Load test data one time##
    TestMySQLHub.load_data()

    suite = TestMySQLHub.getSuite()
    unittest.TextTestRunner(verbosity=2).run(suite)



if __name__ == '__main__':
    main()
