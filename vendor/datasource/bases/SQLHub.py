from timeit import Timer

try:
    import simplejson as json
except ImportError:
    import json

from datasource.bases.RDBSHub import RDBSHub, ChunkIterator, DataIterator, RDBSHubError

class SQLHub(RDBSHub):
    """
    Derived RDBSHub class for MySQL.  Encapsulates sql execution and data retrieval.
    """

    def __init__(self, data_source, **kwargs):

        ##Confirms required keys for datasource config info##
        RDBSHub.__init__(self, data_source)

        ##These attributes are required for certain base class methods##
        self.data_source = data_source
        self.placeholder_char = '%s'

        self.quote_char = """'"""
        self.max_connect_attempts = 20
        self.sleep_interval = 1

        self.client_cursor = None
        if 'cursor' in kwargs:
            self.client_cursor = kwargs['cursor']

        ##Register return_type methods##
        self.valid_return_types['iter'] = self.get_iter
        self.valid_return_types['dict'] = self.get_dict
        self.valid_return_types['dict_json'] = self.get_dict_json
        self.valid_return_types['tuple'] = self.get_tuple
        self.valid_return_types['tuple_json'] = self.get_tuple_json
        self.valid_return_types['set'] = self.get_set
        self.valid_return_types['table'] = self.get_table
        self.valid_return_types['table_json'] = self.get_table_json
        self.valid_return_types['set_json'] = self.get_set_json
        self.valid_return_types['callback'] = self.get_callback

        """
        SQLHub.connection[ host_type ][ con_obj="Connection Object",
                                  cursor="Database cursor" ]
        """
        self.connection = dict()

        ##Configuration object for data source instance##
        self.conf = self.get_data_source_config(self.data_source)

        ##Load the procedures##
        self.load_procs(self.data_source)

        __all__ = ['get_databases',
                   'use_database',
                   'escape_string',
                   'disconnect',
                   'execute',
                   'get_iter',
                   'get_dict',
                   'get_dict_json',
                   'get_list',
                   'get_list_json',
                   'get_set',
                   'get_set_json',
                   'get_callback']

    ##Expose commit, rollback for manual transaction support##
    ##begin() is implicit when a cursor calls execute##
    def commit(self, host_type):
        self.connection[host_type]['con_obj'].commit()

    def rollback(self, host_type):
        self.connection[host_type]['con_obj'].rollback()

    def get_databases(self):
        """
        Return a set of databases available for the datasource. The
        list is dynamically retrieved from the db instance specified
        in the datasource.

        Parameters:
           None

        Returns:
           Set of databases
        """
        ##Retrieve databases dynamically##
        dbs = self.execute(proc='sql.ds_selects.get_databases',
                           return_type='set',
                           key_column='Database')

        return dbs

    def use_database(self, db):
        """
        Selects the database to use.

        Parameters:
           db - Database name

        Returns:
           None
        """
        self.execute(proc='sql.ds_use.select_database',
                     replace=[db] )

    @RDBSHub.execute_decorator
    def execute(self, **kwargs):

        ##These values are populated by the base class execute_decorator
        host_type = kwargs['host_type']
        sql = kwargs['sql']
        db = kwargs['db']

        self.select_db(host_type, db)

        ##########
        #sql_chunks is a list of sql statements to execute.  It's built
        #by the base class when a caller requests chunking.
        ##########
        sql_chunks = kwargs['sql_chunks']

        args = False
        if 'args' in kwargs:
            args = kwargs['args']

        if not self.client_cursor:
            self.try_to_connect(host_type, db)

        if len(sql_chunks) > 0:
            return ChunkIterator(sql_chunks, kwargs, self.__execute)

        return self.__execute(sql, kwargs)

    def get_iter(self, cursor, kwargs):
        return DataIterator(cursor.fetchall(), cursor.description, cursor.rowcount)

    def get_dict(self, cursor, kwargs):

        rows_dict = dict()
        key_column = kwargs['key_column']

        while(1):
            row = cursor.fetchone()
            #All done
            if row == None:
                break

            if key_column in row:
                rows_dict[ row[key_column] ] = row
            else:
                msg = "The key_column provided, %s, does not match any of the available keys %s"%(key_column, ','.join(row.keys))
                raise RDBSHubError(msg)

        return rows_dict

    def get_dict_json(self, cursor, kwargs):
        rows_dict = self.get_dict(cursor, kwargs)
        return json.dumps(rows_dict)

    def get_tuple(self, cursor, kwargs):
        return cursor.fetchall()

    def get_tuple_json(self, cursor, kwargs):
        rows = self.get_tuple(cursor, kwargs)
        return json.dumps(rows)

    def get_set(self, cursor, kwargs):

        db_set = set()
        key_column = kwargs['key_column']

        while(1):
            row = cursor.fetchone()
            #All done
            if row == None:
                break
            if key_column in row:
                db_set.add(row[key_column])
            else:
                msg = "The key_column provided, %s, does not match any of the available keys %s"%(key_column, ','.join(row.keys))
                raise RDBSHubError(msg)

        return db_set

    def get_set_json(self, cursor, kwargs):
        ##Sets are not serializable into json, build a dict with None for each key##
        rows_dict = dict()
        key_column = kwargs['key_column']
        while(1):
            row = cursor.fetchone()
            #All done
            if row == None:
                break
            if key_column in row:
                rows_dict[row[key_column]] = None
            else:
                msg = "The key_column provided, %s, does not match any of the available keys %s"%(key_column, ','.join(row.keys))
                raise RDBSHubError(msg)

        return json.dumps(rows_dict)

    def get_table(self, cursor, kwargs):

        ##Get ordered list of column names##
        cols = []
        for row in cursor.description:
            cols.append( row[0] )
        data = cursor.fetchall()

        return { 'columns':cols, 'data':data }

    def get_table_json(self, cursor, kwargs):
        data_struct = self.get_table(cursor, kwargs)
        return json.dumps(data_struct)

    def get_callback(self, cursor, kwargs):
        callback = kwargs['callback']
        if cursor.rowcount > 0:
            while(1):
                row = cursor.fetchone()
                #All done
                if row == None:
                    break
                callback(row)

    def disconnect(self):
        """
        Close the db cursor and commit/close the connection object for all
        host types found in SQLHub.connection:

        Parameters:
           None

        Return:
           None
        """
        for host_type in self.connection:
            if self.connection[host_type]['cursor']:
                self.connection[host_type]['cursor'].close()

            if self.connection[host_type]['con_obj'].open:
                self.connection[host_type]['con_obj'].commit()
                self.connection[host_type]['con_obj'].close()


    """
    Private Methods
    """
    def connect(self, host_type, db):
        raise NotImplemented

    def try_to_connect(self, host_type, db):
        raise NotImplemented

    def __execute(self, sql, kwargs):

        db = kwargs['db']
        host_type = kwargs['host_type']
        cursor = None
        if self.client_cursor:
            cursor = self.client_cursor
        else:
            cursor = self.connection[host_type]['cursor']

        ##Get the proc name for debug message##
        proc = ""
        if 'proc' in kwargs:
            proc = kwargs['proc']

        ##Caller requests no sql execution##
        if 'debug_noex' in kwargs:
            self.show_debug(db,
                           self.conf[host_type]['host'],
                           host_type,
                           proc,
                           sql,
                           None)
            return []

        ##Caller wants to sql execution time##
        if ('debug_show' in kwargs) and (kwargs['debug_show']):

            def timewrapper():
                self.__cursor_execute(sql, kwargs, cursor)

            t = Timer(timewrapper)
            tmsg = t.timeit(1)

            self.show_debug(db,
                           self.conf[host_type]['host'],
                           host_type,
                           proc,
                           sql,
                           tmsg)
        else:
            self.__cursor_execute(sql, kwargs, cursor)

        """
        If the flag nocommit is set, postpone commit.
        Otherwise, automatically commit after a transaction.
        """
        if not kwargs.get('nocommit', False):
            self.connection[host_type]['con_obj'].commit()

        return self.get_data(cursor, kwargs)

    def __cursor_execute(self, sql, kwargs, cursor):
        if 'placeholders' in kwargs:

            if ('executemany' in kwargs) and kwargs['executemany']:
                cursor.executemany(sql, kwargs['placeholders'])
            else:
                cursor.execute(sql, kwargs['placeholders'])
        else:
            cursor.execute(sql)
