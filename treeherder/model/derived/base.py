"""
``TreeHerderModelBase`` (and subclasses) are the public interface for all data
access.

"""
from django.conf import settings

from treeherder.model.sql.sql_datasource import SQLDataSource


class TreeherderModelBase(object):
    """Base model class for all TreeHerder models"""

    def __init__(self, project):
        self.project = project

        self.sources = {}
        for ct in self.CONTENT_TYPES:
            self.sources[ct] = SQLDataSource(project, ct)

        self.DEBUG = settings.DEBUG

    def __unicode__(self):
        """Unicode representation is project name."""
        return self.project

    def disconnect(self):
        """Iterate over and disconnect all data sources."""
        for src in self.sources.itervalues():
            src.disconnect()

    def get_project_cache_key(self, str_data):
        return "{0}_{1}".format(self.project, str_data)
