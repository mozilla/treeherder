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
        if not procs_file_name:
            procs_file_name = "{0}.json".format(contenttype)

        if not contenttype in self.dhubs.keys():
            self.dhubs[contenttype] = self.get_datasource(
                contenttype).dhub(procs_file_name)

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
        """Given an ``id`` get the row for that item."""
        iter_obj = self.get_dhub(contenttype).execute(
            sql="SELECT * FROM `{0}` WHERE `id` = ?".format(table_name),
            placeholders=[obj_id],
            host_type="master_host",
            debug_show=self.DEBUG,
            return_type='iter',
        )

        return iter_obj


class DatasetNotFoundError(ValueError):
    pass
