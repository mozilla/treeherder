"""
``TreeHerderModelBase`` (and subclasses) are the public interface for all data
access.

"""
import time
import random
import logging

from _mysql_exceptions import OperationalError
from django.conf import settings

from treeherder.model.models import Datasource
from treeherder.model.derived.refdata import RefDataManager


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

    def __unicode__(self):
        """Unicode representation is project name."""
        return self.project

    @classmethod
    def get_oauth_credentials(cls):

        credentials = {}

        for source in Datasource.objects.cached():

            if (source.contenttype == 'objectstore') and \
               source.oauth_consumer_key and \
               source.oauth_consumer_secret:

                credentials[ source.project ] = {
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

        if not contenttype in self.dhubs.keys():
            datasource = self.get_datasource(contenttype)

            self.dhubs[contenttype] = datasource.dhub(procs_file_name)
        return self.dhubs[contenttype]

    def retry_execute(self, dhub, **kwargs):
        try:
            return dhub.execute(**kwargs)
        except OperationalError:
            retries = kwargs.get('retries', 0) + 1

            if retries < 20:
                sleep_time = round(random.random() * .05, 3)  # 0 to 50ms
                self.logger.info(
                    "MySQL operational error hit.  Retry #{0} in {1}s: {2}".format(
                        retries, sleep_time, kwargs
                    ))
                time.sleep(sleep_time)
                kwargs['retries'] = retries
                return self.retry_execute(dhub, **kwargs)
            else:
                raise

    def get_datasource(self, contenttype):
        """The datasource for this contenttype of the project."""

        if not contenttype in self.sources.keys():
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
                list( range(last_id - (row_count - 1), last_id + 1 ) )
                )

        return ids

    def submit_publish_to_pulse_tasks(self, ids, data_type):

        from treeherder.model.tasks import publish_to_pulse
        publish_to_pulse.apply_async(
            args=[self.project, ids, data_type]
            )

    def get_row_by_id(self, contenttype, table_name, obj_id):
        """
        Given an ``id`` get the row for that item.
        Return none if not found
        """
        proc = "generic.selects.get_row_by_id"
        iter_obj = self.get_dhub(contenttype).execute(
            proc=proc,
            replace=[table_name],
            placeholders=[obj_id],
            debug_show=self.DEBUG,
            return_type='iter',
        )
        return self.as_single(iter_obj, table_name, id=obj_id)


    def disconnect(self):
        """Iterate over and disconnect all data sources."""
        self.refdata_model.disconnect()
        for dhub in self.dhubs.itervalues():
            dhub.disconnect()

    def _get_datasource(self, contenttype):
        """Find the datasource for this contenttype in the cache."""
        candidate_sources = []
        for source in Datasource.objects.cached():
            if (source.project == self.project and
                    source.contenttype == contenttype):
                candidate_sources.append(source)

        if not candidate_sources:
            raise DatasetNotFoundError(self.project, contenttype)

        candidate_sources.sort(key=lambda s: s.dataset, reverse=True)

        return candidate_sources[0]


class DatasetNotFoundError(ValueError):
    def __init__(self, project, contenttype,  *args, **kwargs):
        super(DatasetNotFoundError, self).__init__(*args, **kwargs)
        self.project = project
        self.contenttype = contenttype

        def __unicode__(self):
            return u"No dataset found for project {0} and contenttype '{1}'".format(
            self.project,
            self.contenttype,
            )


class ObjectNotFoundException(Exception):
    """When querying for an object and it is not found """

    def __init__(self, table, *args, **kwargs):
        super(ObjectNotFoundException, self).__init__(args, kwargs)
        self.table = table
        self.extra_info = kwargs

    def __unicode__(self):
        return u"ObjectNotFoundException: For table '{0}': {1}".format(
            self.table,
            unicode(self.extra_info),
            )
