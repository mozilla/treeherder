# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

"""
``TreeHerderModelBase`` (and subclasses) are the public interface for all data
access.

"""
import logging

from django.conf import settings
from django.utils.encoding import python_2_unicode_compatible

from treeherder.model.models import Datasource
from treeherder.model.derived.refdata import RefDataManager


@python_2_unicode_compatible
class TreeherderModelBase(object):

    """
    Base model class for all derived models

    """
    logger = logging.getLogger(__name__)

    def __init__(self, project):
        """Encapsulate the dataset access for this ``project`` """

        self.project = project
        self.sources = {}
        self.dhubs = {}
        self.DEBUG = settings.DEBUG
        self.refdata_model = RefDataManager()

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        self.disconnect()

    def __str__(self):
        """String representation is project name."""
        return self.project

    @classmethod
    def get_oauth_credentials(cls):

        credentials = {}

        for source in Datasource.objects.cached():

            if (source.contenttype == 'jobs') and \
               source.oauth_consumer_key and \
               source.oauth_consumer_secret:

                credentials[source.project] = {
                    'consumer_key': source.oauth_consumer_key,
                    'consumer_secret': source.oauth_consumer_secret
                }

        return credentials

    def get_dhub(self, contenttype, procs_file_name=None):
        """
        The configured datahub for the given contenttype

        """
        if not procs_file_name:  # pragma: no cover
            procs_file_name = "{0}.json".format(contenttype)

        if contenttype not in self.dhubs.keys():
            datasource = self.get_datasource(contenttype)

            self.dhubs[contenttype] = datasource.dhub(procs_file_name)
        return self.dhubs[contenttype]

    def get_datasource(self, contenttype):
        """The datasource for this contenttype of the project."""

        if contenttype not in self.sources.keys():
            self.sources[contenttype] = self._get_datasource(contenttype)

        return self.sources[contenttype]

    def get_inserted_row_ids(self, dhub):
        """
        InnoDB guarantees sequential numbers for AUTO INCREMENT when doing
        bulk inserts, provided innodb_autoinc_lock_mode is set to 0
        (traditional) or 1 (consecutive).

        Consequently you can get the first ID from LAST_INSERT_ID() and the
        last by adding ROW_COUNT()-1

        ref: http://stackoverflow.com/questions/7333524/how-can-i-insert-many-rows-into-a-mysql-table-and-get-ids-back

        NOTE: The cursor rowcount is always one for a
              INSERT INTO/SELECT FROM DUAL WHERE NOT EXISTS query otherwise
              it's equal to the number of rows inserted or updated.
        """

        row_count = dhub.connection['master_host']['cursor'].rowcount
        ids = []

        if row_count > 0:
            last_id = dhub.connection['master_host']['cursor'].lastrowid
            ids.extend(
                list(range(last_id - (row_count - 1), last_id + 1))
            )

        return ids

    def _process_conditions(self, conditions, allowed_fields=None):
        """Transform a list of conditions into a list of placeholders and
        replacement strings to feed a datahub.execute statement."""
        placeholders = []
        replace_str = ""
        if conditions:
            for column, condition in conditions.items():
                if allowed_fields is None or column in allowed_fields:
                    if column in allowed_fields:
                        # we need to get the db column string from the passed
                        # in querystring column.  It could be the same, but
                        # often it will have a table prefix for the column.
                        # This allows us to have where clauses on joined fields
                        # of the query.
                        column = allowed_fields[column]
                    for operator, value in condition:
                        replace_str += "AND {0} {1}".format(column, operator)
                        if operator == "IN":
                            # create a list of placeholders of the same length
                            # as the list of values
                            replace_str += "({0})".format(
                                ",".join(["%s"] * len(value))
                            )
                            placeholders += value
                        else:
                            replace_str += " %s "
                            placeholders.append(value)

        return replace_str, placeholders

    def disconnect(self):
        """Iterate over and disconnect all data sources."""
        self.refdata_model.disconnect()
        for dhub in self.dhubs.itervalues():
            dhub.disconnect()

    def _get_datasource(self, contenttype):
        """Find the datasource for this contenttype in the cache."""
        try:
            return next(source for source in Datasource.objects.cached()
                        if source.project == self.project and source.contenttype == contenttype)
        except StopIteration:
            raise DatasetNotFoundError(self.project, contenttype)


@python_2_unicode_compatible
class DatasetNotFoundError(ValueError):

    def __init__(self, project, contenttype, *args, **kwargs):
        super(DatasetNotFoundError, self).__init__(*args, **kwargs)
        self.project = project
        self.contenttype = contenttype

    def __str__(self):
        return u"No dataset found for project {0} and contenttype '{1}'".format(
            self.project,
            self.contenttype,
        )


@python_2_unicode_compatible
class ObjectNotFoundException(Exception):

    """When querying for an object and it is not found """

    def __init__(self, table, *args, **kwargs):
        super(ObjectNotFoundException, self).__init__(args, kwargs)
        self.table = table
        self.extra_info = kwargs

    def __str__(self):
        return u"ObjectNotFoundException: For table '{0}': {1}".format(
            self.table,
            unicode(self.extra_info),
        )
