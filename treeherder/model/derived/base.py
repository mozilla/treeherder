"""
``TreeHerderModelBase`` (and subclasses) are the public interface for all data
access.

"""
import logging

from django.conf import settings
from django.utils.encoding import python_2_unicode_compatible

from treeherder.model.derived.refdata import RefDataManager
from treeherder.model.models import Datasource


@python_2_unicode_compatible
class TreeherderModelBase(object):

    """
    Base model class for all derived models

    """
    logger = logging.getLogger(__name__)

    def __init__(self, project):
        """Encapsulate the dataset access for this ``project`` """

        self.project = project
        self.source = None
        self.dhub = None
        self.DEBUG = settings.DEBUG
        self.refdata_model = RefDataManager()

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        self.disconnect()

    def __str__(self):
        """String representation is project name."""
        return self.project

    def get_dhub(self, procs_file_name=None):
        """
        The configured datahub

        """
        if not procs_file_name:  # pragma: no cover
            procs_file_name = "jobs.json"

        if not self.dhub:
            datasource = self.get_datasource()

            self.dhub = datasource.dhub(procs_file_name)
        return self.dhub

    def get_datasource(self):
        """The datasource of the project."""

        if not self.source:
            self.source = self._get_datasource()

        return self.source

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
                    if allowed_fields and column in allowed_fields:
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
        if self.dhub:
            self.dhub.disconnect()

    def _get_datasource(self):
        """Find the datasource in the cache."""
        try:
            return next(source for source in Datasource.objects.cached()
                        if source.project == self.project)
        except StopIteration:
            raise DatasetNotFoundError(self.project)


@python_2_unicode_compatible
class DatasetNotFoundError(ValueError):

    def __init__(self, project, *args, **kwargs):
        super(DatasetNotFoundError, self).__init__(*args, **kwargs)
        self.project = project

    def __str__(self):
        return u"No dataset found for project {0}".format(
            self.project,
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
