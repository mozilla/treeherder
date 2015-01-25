import sys
import time

import MySQLdb
import MySQLdb.cursors

import _mysql
from _mysql_exceptions import OperationalError

from datasource.bases.RDBSHub import RDBSHubError
from datasource.bases.SQLHub import SQLHub

class MySQL(SQLHub):
    """
    Derived RDBSHub class for MySQL.  Encapsulates sql execution and data retrieval.
    """

    ##########
    #Was thinking doing an explicit disconnect in a
    #destructor was a good idea but this leads to
    #an issue if the caller passes in a database cursor.  When a
    #database cursor is passed in we cannot call an explicit disconnect
    #and by having an explicit destructor the python gc does not do it's thing.
    #I think this could be a possible source of memory leakage but would need
    #to test more before coming to that conclusion.  For the moment
    #the MySQLdb module appears to automatically disconnect when
    #a MySQL object gets destroyed.  Something to watch out for.
    #########

    def __del__(self):
        self.disconnect()

    def escape_string(self, value):
        """
        Pass through to connection.escape_string which calls mysql_real_escape_string().
        escape_string must be called through the connection object so mysql_real_escape_string
        can take the character set of the connection into account.  If no connection object
        has been constructed use the default host type to make a connection.

        Parameters:
           value - The string to be escaped.
        """
        if not self.connection:
            self.try_to_connect(self.default_host_type, None)

        uval = unicode(value).encode("utf-8")

        return self.connection[self.default_host_type]['con_obj'].escape_string(uval).decode("utf-8")

    def select_db(self, host_type, db):
        if host_type not in self.connection:
            self.try_to_connect(host_type, db)

        if db and db != self.connection[host_type]['db']:
            try:
                self.connection[host_type]['con_obj'].select_db(db)
            except OperationalError:
                ##Connection is corrupt, reconnect.
                ##Meant to deal with OperationalError 2006
                ##MySQL server has gone away errors with Django 1.6
                self.connect(host_type, db)
            self.connection[host_type]['db'] = db
    """
    Private Methods
    """
    def connect(self, host_type, db):

        ##Make sure we really need to connect##
        connect = False
        if host_type in self.connection and self.connection[host_type]['con_obj']:
            try:
                ##We have a connection, make sure it's active##
                self.connection[host_type]['con_obj'].ping()
            except OperationalError:
                ##Connection is corrupt, reconnect##
                connect = True
        else:
            ##No connection for host type, make connection##
            connect = True

        if connect:
            ##No connection exists, connect##
            self.connection[host_type] = dict( con_obj=None, cursor=None)

            if db:
                self.connection[host_type]['con_obj'] = MySQLdb.connect( host=self.conf[host_type]['host'],
                                                                          user=self.conf[host_type]['user'],
                                                                          passwd=self.conf[host_type].get('passwd', ''),
                                                                          charset="utf8",
                                                                          cursorclass=MySQLdb.cursors.DictCursor,
                                                                          db=db)
            else:
                self.connection[host_type]['con_obj'] = MySQLdb.connect( host=self.conf[host_type]['host'],
                                                                          user=self.conf[host_type]['user'],
                                                                          passwd=self.conf[host_type].get('passwd', ''),
                                                                          charset="utf8",
                                                                          cursorclass = MySQLdb.cursors.DictCursor)

            self.connection[host_type]['con_obj'].autocommit(False)
            self.connection[host_type]['cursor'] = self.connection[host_type]['con_obj'].cursor()
            self.connection[host_type]['db'] = db

    def try_to_connect(self, host_type, db):

        for i in range(self.max_connect_attempts):
            try:
                self.connect(host_type, db)

                ##Let someone know this is not happening on the first try##
                if i > 0:
                    sys.stderr.write("\n%s: try_to_connect succeeded on %i attempt. Database:%s" % (__name__, i, db))
                    sys.stderr.flush()
                ##We have a connection, move along##
                break

            except OperationalError, err:
                ##Connect failed, take a breather and then try again##
                sys.stderr.write("\n%s: try_to_connect OperationalError encountered on attempt %i. Database:%s" % (__name__, i, db))
                sys.stderr.write("\nError detected was:\n%s\n" % (err))
                sys.stderr.flush()
                time.sleep(self.sleep_interval)
                continue

        if not self.connection[host_type]['con_obj']:
            ###
            #If we made it here we've tried to connect max_connect_attempts, it's time to throw
            #in the towel.  Clearly the universe is working against us today, chin up
            #tomorrow could be better.
            ###
            raise MySQLConnectError(self.max_connect_attempts, self.data_source)


class MySQLConnectError(RDBSHubError):

    def __init__(self, iterations, data_source):
        self.iter = iterations
        self.data_source = data_source
    def __repr__(self):
        msg = "OperationalError encountered repeatedly while connecting.  Attempted to connect %i times to data source %s and failed... Feeling kindof sad right now :-(" % (self.iter, self.data_source)
