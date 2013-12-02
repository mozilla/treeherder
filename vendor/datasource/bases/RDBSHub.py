"""
This software is licensed under the [Mozilla Tri-License][MPL]:

***** BEGIN LICENSE BLOCK *****
Version: MPL 1.1/GPL 2.0/LGPL 2.1

The contents of this file are subject to the Mozilla Public License Version
1.1 (the "License"); you may not use this file except in compliance with
the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
for the specific language governing rights and limitations under the
License.

The Original Code is DataSouces.

The Initial Developer of the Original Code is
Jonathan Eads (Jeads).
Portions created by the Initial Developer are Copyright (C) 2011
the Initial Developer. All Rights Reserved.

Contributor(s):
   Jonathan Eads <superjeads AT gmail DOT org>

Alternatively, the contents of this file may be used under the terms of
either the GNU General Public License Version 2 or later (the "GPL"), or
the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
in which case the provisions of the GPL or the LGPL are applicable instead
of those above. If you wish to allow use of your version of this file only
under the terms of either the GPL or the LGPL, and not to allow others to
use your version of this file under the terms of the MPL, indicate your
decision by deleting the provisions above and replace them with the notice
and other provisions required by the GPL or the LGPL. If you do not delete
the provisions above, a recipient may use your version of this file under
the terms of any one of the MPL, the GPL or the LGPL.

***** END LICENSE BLOCK *****
"""
import sys
import math
import re

import sys
from datasource.bases.BaseHub import BaseHub, DataHubError

class RDBSHub(BaseHub):
    """
    Base class for all relational database hubs.
    """

    @staticmethod
    def execute_decorator(func):
        """
        Function decorator for execute().  Initializes wrapper
        function that checks the execute rules against the kwargs
        provided by caller and sets values for sql, host_type, db,
        and sql_chunks.  The execute function in all derived RDBSHub's
        should use the execute_decorator.

           Parameters:
              func - function ref

           Returns:
              wrapped function ref
        """
        def wrapper(self, **kwargs):
            self.set_execute_rules(kwargs)
            self.get_execute_data(self.data_source, kwargs)
            return func(self, **kwargs)

        return wrapper

    def __init__(self, data_source_name):
        """
        A derived class of BaseHub, serves as a base class for any Relational
        Database hubs.
        """
        BaseHub.__init__(self)

        ##allowed keys in execute##
        self.execute_keys = set(['db',
                              'proc',
                              'nocommit',
                              'sql',
                              'host_type',
                              'placeholders',
                              'replace',
                              'replace_quote',
                              'limit',
                              'offset',
                              'chunk_size',
                              'chunk_source',
                              'chunk_min',
                              'chunk_total',
                              'executemany',
                              'return_type',
                              'key_column',
                              'callback',
                              'debug_show',
                              'debug_noex' ])

        ##Default values for execute kwargs##
        self.default_host_type = 'master_host'
        self.default_return_type = 'tuple'

        ##replace string base for replace functionality in execute##
        self.replace_string = 'REP'

        #####
        #set of return types that require a key_column
        #####
        self.return_type_key_columns = set(['dict', 'dict_json', 'set', 'set_json'])

        #####
        #One of these keys must be provided to execute
        #####
        self.execute_required_keys = set(['proc', 'sql'])

        ###
        #This data structure is used to map the return_type provided to
        #execute() to the derived hub method.  Derived hub's have to map
        #their methods by setting the appropriate function reference to
        #its associated key in valid_return_types.
        ###
        self.valid_return_types = { 'iter':None,
                                  'dict':None,
                                  'dict_json':None,
                                  'tuple':None,
                                  'tuple_json':None,
                                  'set':None,
                                  'set_json':None,
                                  'table':None,
                                  'table_json':None,
                                  'callback':None }

        ##Dictionary of required keys for RDBS datasources##
        self.data_source_req_keys = dict(
                           #required keys
                           req=set(['hub', 'master_host']),
                           #optional keys but if present have additional key requirements
                           databases=set(['name', 'procs']),
                           master_host=set(['host', 'user']),
                           read_host=set(['host', 'user']),
                           dev_host=set(['host', 'user']) )

        ###
        #List of SQL tokens that must follow a WHERE statement
        ###
        self.post_where_tokens = ['GROUP BY','HAVING','ORDER BY','LIMIT','OFFSET','PROCEDURE','INTO','FOR UPDATE']

        ####
        #Validate the information in data_sources is complete
        #so we can provide the caller with useful messaging
        #regarding what is missing when a class is instantiated.
        ####
        self.validate_data_source(data_source_name)

        self.pretty_sql_regex = re.compile('\s+', re.DOTALL)

        self.default_placeholder = '?'

        __all__ = ['load_procs',
                   'get_proc',
                   'get_data',
                   'validate_data_source',
                   'set_execute_rules',
                   'get_execute_data']

    """
    Public Interface
    """
    def load_procs(self, data_source):
        BaseHub.load_procs(data_source)

    def get_proc(self, data_source, proc):
        """
        Pass through to the BaseHub.get_proc() method.

        Parameters:
           data_source - data source to retrive proc from
           proc - full proc path ex: mysql.selects.get_stuff

        Returns:
           proc datastructure from the data source
        """
        return BaseHub.get_proc(data_source, proc)

    def get_data(self, cursor, kwargs):
        """
        Executes the appropriate derived class get_data function associated
        with the return type.  Derived classes register get_data functions
        in self.valid_return_types[ return_type ] = get_data_function_ref.

        Parameters:
           cursor - db cursor reference
           kwargs - argument dictionary to pass to the derived class execute

        Returns:
           return value of derived class get_data function
        """
        if 'return_type' in kwargs:
            return_type = kwargs['return_type']
            if return_type not in self.valid_return_types:
                msg = 'The return_type value %s is not recognized. Possible values include [%s].'%(return_type, ','.join(self.valid_return_types.keys()))
                raise RDBSHubExecuteError(msg)

            if not self.valid_return_types[return_type]:
                ##Derived class has not mapped a function ref to the return type##
                msg = 'The derived hub, %s, has not mapped a function to %s in self.valid_return_types.'%(self.__class__.__name__, return_type)
                raise RDBSHubExecuteError(msg)

            return_value = self.valid_return_types[return_type](cursor, kwargs)
            return return_value

        else:
            ##Return type not provided##
            msg = 'The return_type key was not provided.  Add key:"return_type" value: [%s] to kwargs.'%(','.join(self.valid_return_types.keys()))
            raise RDBSHubError(msg)

    def validate_data_source(self, data_source_name):
        """
        Iterates through data_source_req_keys and confirms required
        key/value pairs.  Probably a better way of doing this but
        not thinking of anything more elegent at the moment.  Attempting
        to provide the caller with clear messaging regarding missing fields
        in the data source file.

        Parameters:
           data_source_name - name of the datasource to test

        Returns:
           None
        """
        for key in self.data_source_req_keys:
            if key is 'req':
                msg = 'the %s source object in %s' % (data_source_name, BaseHub.source_list_file)
                ##Confirm required keys##
                BaseHub.check_keys(self.data_source_req_keys[key], BaseHub.data_sources[data_source_name], True, msg)
            elif key is 'databases':

                if key in BaseHub.data_sources[data_source_name]:
                    for i in range(len(BaseHub.data_sources[data_source_name][key])):
                        db = BaseHub.data_sources[data_source_name][key][i]
                        msg = 'the %s.%s index position %i in %s' % (data_source_name, key, i, BaseHub.source_list_file)
                        BaseHub.check_keys(self.data_source_req_keys[key], db, True, msg)
            else:
                msg = 'the %s.%s in %s' % (data_source_name, key, BaseHub.source_list_file)
                if key in BaseHub.data_sources[data_source_name]:
                    BaseHub.check_keys(self.data_source_req_keys[key], BaseHub.data_sources[data_source_name][key], True, msg)

    def set_execute_rules(self, kwargs):
        """
        Implement the ruleset associated with the arguments to execute.  If a rule
        fails raise RDBSHubExecuteError.  The entire api to execute() is driven by
        key/value pairs which makes me cringe a bit.  However this provides a very
        convenient command line interface and hopefully it's easy to remember so
        i'm sticking with it.  Compensating for the approach with some explicit
        rules that the base class manages.  We want to make sure the caller gets
        clear messaging on argument requirements.

        Parameters:
           kwargs - kwargs passed to execute

        Returns:
           None
        """
        ####
        #Set default return_type here so we
        #can test for valid return types
        ####
        kwargs.setdefault('return_type', self.default_return_type)

        ###
        #Converting kwargs.keys to a set so
        #we can use snappy set operations, trying
        #to cut down on the number of conditional statements
        ###
        kwargs_set = set(kwargs.keys())

        #########
        #This kinda sucks and won't scale...
        #I can think of some cleaner solutions using classes or functions
        #but trying to keep overhead as light as possible for rule
        #implementation.  If a lot more rules get added fancy might
        #be the way to go here.
        ########

        ###
        # make sure we recognize all of the kwargs
        ###
        if not kwargs_set <= self.execute_keys:
            ##Caller has provided keys not in execute_keys, get the difference##
            d = kwargs_set - self.execute_keys
            raise RDBSHubExecuteError("The following keys, %s, are not recognized by execute()" % (','.join(d)))

        ###
        #  proc or sql must be provided or we have nothing to execute
        ###
        #If we don't have intersection none of the required keys are present##
        if not self.execute_required_keys & kwargs_set:
            raise RDBSHubExecuteError("The proc or sql argument must be provided to execute()")

        ###
        # placeholders and replace must be set to lists
        ###
        if ('placeholders' in kwargs_set) and (type(kwargs['placeholders']) is not list):
            raise RDBSHubExecuteError("The value of the placeholders argument must be a list.")
        if ('replace' in kwargs_set) and (type(kwargs['replace']) is not list):
            raise RDBSHubExecuteError("The value of the replace argument must be a list.")
        ###
        # key_column is required if the return type is dict, dict_json,
        # set, or set_json
        ###
        if (kwargs['return_type'] in self.return_type_key_columns) and ('key_column' not in kwargs_set):
            ##No key_columns found in kwargs_set##
            raise RDBSHubExecuteError("return types of %s require the key_column argument" % ','.join(self.return_type_key_columns))

        ###
        # If a return type of callback is selected a callback key must be
        # provided wih a function reference
        ###
        if (kwargs['return_type'] == 'callback') and ('callback' not in kwargs_set):
            raise RDBSHubExecuteError("the callback return type requires the callback argument")

        ###
        # chunk_size must be provided with a chunk_source
        ###
        if ('chunk_size' in kwargs_set) and ('chunk_source' not in kwargs_set):
            raise RDBSHubExecuteError("when a chunk size is provided the chunk_source argument must be provided")
        if ('chunk_source' in kwargs_set) and ('chunk_size' not in kwargs_set):
            raise RDBSHubExecuteError("when a chunk column is provided the chunk_size argument must be provided")

    def get_execute_data(self, data_source, kwargs):

        ##Al of these values are loaded in kwargs##
        db = ""
        sql_struct = None
        host_type = ""
        sql = ""
        sql_chunks = []

        ##Set sql##
        if 'proc' in kwargs:
            sql_struct = self.get_proc(data_source, kwargs['proc'])
            sql = sql_struct['sql']
            ##If a host type is found in the proc file use it
            if 'host_type' in sql_struct:
                host_type = sql_struct['host_type']
        elif 'sql' in kwargs:
            sql = kwargs['sql']

        ##Set host_type##
        if 'host_type' in kwargs:
            ####
            #If the caller provides a host_type, override one
            #found in the proc file
            ####
            host_type = kwargs['host_type']
        elif not host_type:
            ##No host type in proc file or in kwargs, set default
            host_type = self.default_host_type

        ##Set db##
        if 'db' in kwargs:
            db = kwargs['db']
        elif 'default_db' in self.conf:
            db = self.conf['default_db']
            kwargs['db'] = db
        #####
        #If we make it here and db is still not set, caller could be
        #using explicit database names in their SQL.  If their not
        #we will get an error from the RDBS
        #####

        if 'placeholders' in kwargs:
            ##Set DB interface placeholder char##
            sql = sql.replace(self.default_placeholder, self.placeholder_char)

        ##Make replacements in sql##
        key = ""
        quote = False
        if 'replace' in kwargs:
            key = 'replace'
        elif 'replace_quote' in kwargs:
            key = 'replace_quote'
            quote = True
        if key:
            sql = self.__replace_sql(sql, key, kwargs, quote)

        ##Set limits and offset##
        if 'limit' in kwargs:
            sql = "%s LIMIT %s" % (sql, str(kwargs['limit']))
        if 'offset' in kwargs:
            sql = "%s OFFSET %s" % (sql, str(kwargs['limit']))

        ####
        #Compute number of execute sets if user requests chunking
        #ORDER IS CRITICAL HERE: sql must be passed to chunk stuff
        #after all alterations are made to it.
        ####
        if ('chunk_size' in kwargs) and ('chunk_source' in kwargs):
            sql_chunks = self.__get_execute_sets(sql, kwargs)

        ##Load data for execute##
        kwargs['sql'] = sql
        kwargs['host_type'] = host_type
        kwargs['db'] = db
        kwargs['sql_chunks'] = sql_chunks

    def show_debug(self, db, host, host_type, proc, sql, tmsg):
        """
        Writes debug message to stdout.

        Parameters:
           db - name of database that query is executed against
           host - host name the database resides on.
           host_type - type of host ex: master_host, read_host, or dev_host
           proc - full path to proc
           tmsg - execution time

        Returns:
           None
        """
        msg = ""

        sql = self.pretty_sql_regex.sub(" ", sql)
        if tmsg:
            msg = "%s debug message:\n\thost:%s db:%s host_type:%s proc:%s\n\tExecuting SQL:%s\n\tExecution Time:%.4e sec\n\n"\
                  %(self.__class__, host, db, host_type, proc, sql, tmsg)
        else:
            msg = "%s debug message:\n\thost:%s db:%s host_type:%s proc:%s\n\tExecuting SQL:%s\n\n"\
                  %(self.__class__, host, db, host_type, proc, sql)

        sys.stdout.write( unicode(msg).encode("utf-8") )
        sys.stdout.flush()

    def escape_string(self, value):
        # Should be implemented in the subclass
        raise NotImplemented()

    ######
    #Private methods
    ######
    def __replace_sql(self, sql, key, kwargs, quote):
        for i in range(len(kwargs[key])):
            r = kwargs[key][i]
            if quote:

                r_string = u''
                if type(r) == type([]):
                    join_char = u"%s,%s"%(self.quote_char,self.quote_char)
                    ###
                    #r could contain integers which will break join
                    #make sure we cast to strings
                    ###
                    r_string = join_char.join( map(lambda s: self.escape_string(s), r) )

                else:
                    r_string = self.escape_string(r)

                sql = sql.replace(u"%s%i"%(self.replace_string, i), u"%s%s%s"%(self.quote_char, r_string, self.quote_char))

            else:

                if type(r) == type([]):
                    ###
                    #r could contain integers which will break join
                    #make sure we cast to strings
                    ###
                    r = u",".join(map(str, r))

                sql = sql.replace(u"%s%i"%(self.replace_string, i), r)

        ####
        #If any replace failed, make sure we get rid of all of
        #the REP strings
        ####
        sql = re.sub( u'%s%s' % (self.replace_string, u'\d+'), u'', sql)

        return sql

    def __get_execute_sets(self, sql, kwargs):

        table, column = kwargs['chunk_source'].split('.')
        chunk_size = int(kwargs['chunk_size'])

        chunk_start = 0
        if 'chunk_min' in kwargs:
            chunk_start = int(kwargs['chunk_min'])

        if not (table and column and chunk_size):
            msg = "chunk_source must be set to explicit column name that includes the table. Example: table_name.column_name"
            raise RDBSHubError(msg)

        max = self.execute( db=kwargs['db'],
                            proc='sql.ds_selects.get_max',
                            replace=[ column, table ],
                            return_type='iter')

        min_id = 0
        if 'chunk_min' in kwargs:
            min_id = int( kwargs['chunk_min'] ) 
        else:
            min = self.execute( db=kwargs['db'],
                                proc='sql.ds_selects.get_min',
                                replace=[ column, table ],
                                return_type='iter')
            min_id = int(min.get_column_data('min_id') or min_id)

        max_id = int(max.get_column_data('max_id') or 0)
        if 'chunk_total' in kwargs:
            max_id = min_id + int(kwargs['chunk_total']) - 1

        ##Total rows##
        n_rows = (max_id - min_id + 1)

        ##Total sets##
        n_sets = int(math.floor(float(n_rows)/float(chunk_size)))

        ##Load table and column for execute##
        kwargs['chunk_table'] = table
        kwargs['chunk_column'] = column

        sql_chunks = []
        if n_sets < 1:
            id_set = range(min_id, max_id + 1)
            set_sql = self.__build_set_where(id_set, sql, kwargs)
            sql_chunks.append(set_sql)

        else:
            ##Get all the set id chunks for execute##
            id_set = []
            for set_num in range(n_sets):
                id_set = range(min_id+set_num*chunk_size, min_id+(set_num+1)*chunk_size)
                set_sql = self.__build_set_where(id_set, sql, kwargs)
                sql_chunks.append(set_sql)

            ##Get any remainder statements##
            remainder_min = id_set[ len(id_set) - 1 ]

            if remainder_min < max_id:
                start_id = remainder_min + 1
                remainder_set = range(start_id, max_id + 1)

                set_sql = self.__build_set_where(remainder_set, sql, kwargs)
                sql_chunks.append(set_sql)

        return sql_chunks


    def __build_set_where(self, id_set, sql, kwargs):

        #####
        #Build the WHERE IN clause for chunk set
        #####
        t = kwargs['chunk_table']
        c = kwargs['chunk_column']

        where_in_sql = '(%s IN (%s))' % (c, ','.join(map(str, id_set)))

        where_index = sql.find('WHERE')

        if where_index > 0:
            ####
            #Statement already has a WHERE clause, append just the IN (list) bit
            ####
            sql = '%s %s AND %s' % (sql[0:(where_index+5)],where_in_sql,sql[(where_index+6):])
            return sql
        else:
            ####
            #We don't have a WHERE clause, check for post_where_tokens to place
            #the WHERE clause before
            ####
            for token in self.post_where_tokens:
                token_index = sql.find(token)
                if token_index > 0:
                    sql = '%s WHERE %s %s' % (sql[0:(token_index-1)],where_in_sql,sql[token_index:])
                    return sql

        ######
        #If we make it to here the sql has no pre-existing
        #WHERE and no post_where_tokens, we can append safely
        ######
        sql += ' WHERE %s'%(where_in_sql)

        return sql

class ChunkIterator:

    def __init__(self, sql_chunks, kwargs, execute_ref):

        self.sql_chunks = sql_chunks
        self.kwargs = kwargs
        self.chunks = len(sql_chunks)
        self.chunk_index = 0
        self.execute_ref = execute_ref

    def __iter__(self):
        return self

    def next(self):

        try:
            sql = self.sql_chunks[ self.chunk_index ]
            self.chunk_index += 1
            return self.execute_ref(sql, self.kwargs)

        except IndexError:
            ##Reset iterator##
            self.chunk_index = 0
            raise StopIteration

class DataIterator:

    def __init__(self, data, desc, rowcount):

        self.data = data
        self.description = desc
        self.rowcount = rowcount
        self.row_index = 0

    def __iter__(self):
        return self

    def get_column_data(self, column_name):

        try:
            return self.data[0][column_name]

        except IndexError:
            ##Either no column match, or no data##
            return None

    def next(self):
        try:
            row = self.data[ self.row_index ]
            self.row_index += 1
            return row

        except IndexError:
            ##Reset iterator##
            self.row_index = 0
            raise StopIteration

class RDBSHubError(DataHubError):
    """Base class for all RDBSHub derived class errors.  Takes an error message and returns string representation in __repr__."""
    def __init__(self, msg):
        self.msg = msg
    def __repr__(self):
        return self.msg

class RDBSHubExecuteError(DataHubError):
    def __init__(self, msg):
        self.msg = msg
    def __repr__(self):
        return self.msg
