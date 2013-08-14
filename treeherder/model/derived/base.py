"""
``TreeHerderModelBase`` (and subclasses) are the public interface for all data
access.

"""
from django.conf import settings

from treeherder.model.models import Datasource
from treeherder.model.derived.refdata import RefDataManager


class TreeherderModelBase(object):
    """
    Base model class for all derived models

    """

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

    def get_datasource(self, contenttype):
        """The datasource for this contenttype of the project."""

        if not contenttype in self.sources.keys():
            self.sources[contenttype] = self._get_datasource(contenttype)

        return self.sources[contenttype]

    def _get_datasource(self, contenttype):
        """Find the datasource for this contenttype in the cache."""
        candidate_sources = []
        for source in Datasource.objects.cached():
            if (source.project == self.project and
                    source.contenttype == contenttype):
                candidate_sources.append(source)

        if not candidate_sources:
            raise DatasetNotFoundError(
                "No dataset found for project %r, contenttype %r."
                % (self.project, contenttype)
            )

        candidate_sources.sort(key=lambda s: s.dataset, reverse=True)

        return candidate_sources[0]

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

    def as_list(self, iter_obj, table_name, **kwargs):
        try:
            return list(iter_obj)
        except StopIteration:
            raise ObjectNotFoundException(table_name, **kwargs)

    def as_single(self, iter_obj, table_name, **kwargs):
        try:
            return iter_obj.next()
        except StopIteration:
            raise ObjectNotFoundException(table_name, **kwargs)

    def disconnect(self):
        """Iterate over and disconnect all data sources."""
        self.refdata_model.disconnect()
        for dhub in self.dhubs.itervalues():
            dhub.disconnect()



class DatasetNotFoundError(ValueError):
    pass


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