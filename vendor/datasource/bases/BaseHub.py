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
import os

try:
    import simplejson as json
except ImportError:
    import json

import pprint
import re

class BaseHub:
    """
    A base class for all derived data hub classes.
    """
    ##CLASS ATTRIBUTES##

    #Regex for removing python style comments, newlines, and tabs from a multiline string
    comment_regex = re.compile('\"\"\".*?\"\"\"|\#.*?\n|\n|\t', re.DOTALL)

    #Data structure holding all data sources
    data_sources = dict()

    #data structure mapping data sources to associated procedures
    procs = dict( sql=dict() )

    #Full path to data source json file
    source_list_file = ''

    #Name of environment variable pointing to the data source json file
    data_source_env = 'DATASOURCES'

    default_data_source_file = 'data_sources.json'

    #Directory containing procs for unit tests and general sql
    default_proc_dir = 'procs'

    ##List of all built in proc files##
    built_in_procs = []

    ##END CLASS ATTRIBUTES##

    def __init__(self):
        ##Public Interface Methods##
        __all__ = ['get_data_source_config']

    """
    Static Methods
    """
    @staticmethod
    def get_sources(source_file_path, default_source):
        """
        Staticmethod that loads list of data sources from a json file.

           Parameters: None

           Returns: None
        """
        source_file_obj = open(source_file_path)

        source_file = None
        try:
            source_file = source_file_obj.read()
        finally:
            source_file_obj.close()

        data_sources = BaseHub.deserialize_json(source_file)

        if default_source:
            ##Load the procs##
            for d in data_sources:
                ####
                #Might eventually need a way to load these for specific
                #sources.  This approach loads all procs into all sources
                #but it will suffice for now...
                ####
                data_sources[d].update( { BaseHub.default_proc_dir:BaseHub.built_in_procs } )

        BaseHub.add_data_source(data_sources)

    @staticmethod
    def deserialize_json(source_file):
        """
        Staticmethod for deserializing json with python style comments in it.

           Parameters:
              source_file - Multi line string containing json to deserialize.  Can
                           contain python style comments that will be removed before
                           before deserialization.

              Returns:
                 python object without comments
        """
        return json.loads(BaseHub.strip_python_comments(source_file))

    @staticmethod
    def strip_python_comments(data_string):
        """
        Staticmethod that strips python style comments out of a string

           Parameters:
              data_string - Multiline string with python style comments

           Returns:
              python string with comments removed
        """
        return BaseHub.comment_regex.sub(" ", data_string)

    @staticmethod
    def check_keys(req_keys, dict_target, defined=False, source_name=""):
        """
        Staticmethod that checks keys and values in dictionary.  Raises
        DataSourceKeyError if a required key or value is not defined.
        The main usage of check_keys is when we need to let the caller know
        something is missing from a critical file like data_sources.json
        or an associated procedure file.

        Parameters:
           req_keys - A list of required keys.
           dict_target - Dictionary to test against.
           defined - Boolean, defaults to undefined.  If true the key values are
                     required to be defined.
           source_name - Defaults to the str representation of the dict_target. Caller
                        can set this to any str.  For instance if the structure being
                        tested is loaded from a file, using the file name as the source_name
                        is a good hint for the caller.

        Returns:
           None
        """
        missing_keys = []
        values_not_defined = []

        for key in req_keys:
            if key not in dict_target:
                missing_keys.append(key)
            else:
                if defined:
                    if not dict_target[key]:
                        values_not_defined.append(key)

        msg = ""
        m_len = 0
        ##Caller requires keys only##
        if missing_keys:
            ##Set source name to dict_target variable name##
            if not source_name:
                pp = pprint.PrettyPrinter(indent=3)
                source_name = pp.pformat(dict_target)

            m_len = len(missing_keys)
            if m_len > 1:
                msg = 'The required keys: [%s] were not found in\n%s' % (','.join(missing_keys), source_name)
            else:
                msg = 'The required key, %s, was not found in\n%s' % (','.join(missing_keys), source_name)

            raise DataSourceKeyError(msg)

        ##Caller requires key values to be defined##
        if values_not_defined:
            ##Set source name to dict_target variable name##
            if not source_name:
                pp = pprint.PrettyPrinter(indent=4)
                source_name = pp.pformat(dict_target)

            m_len = len(values_not_defined)
            if m_len > 1:
                msg = 'The following keys do not have values: [%s] in\n%s' % (','.join(values_not_defined), source_name)
            else:
                msg = 'The following key, %s, does not have a value in\n%s' % (','.join(values_not_defined), source_name)

            raise DataSourceError(msg)

    @staticmethod
    def load_procs(data_source):
        """
        Loads procedure json files specified in data_sources.json into BaseHub.procs.
        The outer key is the file name with no extension.

        procs = { "data source": { "proc file name with no file ext": ... any number of keys/dict followed by:

        Special handling occurs when the file name is sql.json.  This procs in this file
        will be loaded into a general proc space that is accessible to all data sources.
        It can be accessed by using sql.myproc as the proc name passed to execute.

        --------------
        Statement dict
        --------------
        "proc name": { sql:"SQL statement",
                       host_type:"Optional key designating host type" }

           Parameters:
              data_source - The name of the data source to load procs for

           Returns:
              None
        """

        if data_source in BaseHub.data_sources and \
           'procs' in BaseHub.data_sources[data_source] and \
           data_source not in BaseHub.procs:

            BaseHub.procs[data_source] = dict()

            for file in BaseHub.data_sources[data_source]['procs']:

                ##Load file##
                proc_file_obj = open(file)
                try:
                    proc_file = proc_file_obj.read()
                finally:
                    proc_file_obj.close()

                ##Use file name as key##
                head, tail = os.path.split(file)
                name, ext = os.path.splitext(tail)

                if name in BaseHub.procs[data_source]:
                    ##Duplicate file name detected##
                    msg = 'A duplicate proc file, %s, was found in the data source %s.  Please change the file name.' % (file, data_source)
                    raise DataHubError(msg)

                if 'sql.json' in file:
                    BaseHub.procs['sql'].update( { name:BaseHub.deserialize_json(proc_file) } )
                else:
                    BaseHub.procs[data_source].update( { name:BaseHub.deserialize_json(proc_file) } )

    @staticmethod
    def get_proc(data_source, proc):
        """
        Returns the requested procedure from the BaseHub.procs data structure.

           Parameters:
              data_source - The name of the data source to retrieve procs from
              proc - The full '.' delimieted path to the proc. ex: proc_file.selects.proc_name

           Returns:
              Data structure containing the requested procedure
        """
        proc_struct = None
        fields = proc.split('.')

        ####
        # A base name of sql allows clients to
        # store general purpose sql that is
        # available for all data sources
        ####
        sql = False
        if fields[0] == 'sql':
            data_source = 'sql'

        for i in range(len(fields)):
            key = fields[i]
            try:
                if i == 0:
                    proc_struct = BaseHub.procs[data_source][key]
                else:
                    proc_struct = proc_struct[key]
            except KeyError:
                msg = "The key, %s, provided in %s was not found in the data source %s in %s" % (key, proc, data_source, BaseHub.source_list_file)
                raise DataHubError(msg)

        return proc_struct

    @staticmethod
    def add_data_source(data_source_struct):
        """
        Adds a datasource data structure to BaseHub.data_sources and loads the
        associated proc files.  Raises DataHubError if the data_source already
        exists.

        Parameters:
           data_source_struct - A datasource structure.

        Returns:
           None
        """
        for data_source in data_source_struct:

            if data_source not in BaseHub.data_sources:
                ##Load the new source##
                BaseHub.data_sources[data_source] = data_source_struct[data_source]

                ##Load the procs##
                BaseHub.load_procs(data_source)

    @staticmethod
    def load_builtin_procs(arg, dirname, names):
        for file_name in names:
            name, file_ext = os.path.splitext(file_name)
            if file_ext == '.json':
                BaseHub.built_in_procs.append("%s/%s"%(dirname,file_name))
    """
    Member Functions
    """
    def get_data_source_config(self, data_source_name):

        if data_source_name in BaseHub.data_sources:
            return BaseHub.data_sources[data_source_name]

        msg = 'The data source, %s, was not found.  Available datasources include %s.'
        raise DataHubError(msg%(data_source_name, ','.join(BaseHub.data_sources.keys())))

"""
Error classes
"""
class DataHubError:
    """Base class for all data hub errors.  Takes an error message and returns string representation in __repr__."""
    def __init__(self, msg):
        self.msg = msg
    def __repr__(self):
        return self.msg


class DataSourceError (BaseException):
    """ Problem Connecting. """
    def __init__(self, msg):
        self.msg = msg
    def __repr__(self):
        return self.msg


class DataSourceKeyError(DataHubError):
    """Dictionary key error.  Raised when a required key or key value is not defined"""
    def __init__(self, msg):
        self.msg = msg
    def __repr__(self):
        return self.msg

if not BaseHub.data_sources:
    """
    Initialize BaseHub class variable data only once.
    """
    if not BaseHub.data_sources:

        ####
        # load the data_sources.json file
        # its used for unit tests
        ####
        procs_path = os.path.dirname(__file__).replace('bases', BaseHub.default_proc_dir)
        os.path.walk(procs_path, BaseHub.load_builtin_procs, {})

        test_data_source_path = os.environ.get(
           "DATASOURCES",
           os.path.join(
              os.path.dirname(os.path.dirname(__file__)),
              BaseHub.default_data_source_file
              )
           )

        BaseHub.get_sources(test_data_source_path, True)

        #####
        #Load datasource file specified by env variable
        #####
        if BaseHub.data_source_env in os.environ:
            BaseHub.source_list_file = os.environ[BaseHub.data_source_env]

            ##Get the data sources##
            BaseHub.get_sources(BaseHub.source_list_file, False)
