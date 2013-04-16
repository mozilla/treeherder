"""
Provides a SQLDataSource class which reads datasource configuration from the
datasource table.
"""
import datetime
import os
import subprocess
import uuid

from datasource.bases.BaseHub import BaseHub
from datasource.hubs.MySQL import MySQL
from django.conf import settings
from django.core.cache import cache
from django.db import models, transaction
import MySQLdb

from treeherder.model.models import Datasource


class DatasetNotFoundError(ValueError):
    pass


class SQLDataSource(object):
    """
    Encapsulates SQL queries against a specific data source.

    """
    def __init__(self, project, contenttype, procs_file_name=None):
        """
        Initialize for given project, contenttype, procs file.

        If not supplied, procs file name defaults to the name of the
        contenttype with ``.json`` appended.

        """
        self.DEBUG = settings.DEBUG
        self.project = project
        self.contenttype = contenttype
        self.procs_file_name = procs_file_name or "%s.json" % contenttype
        self._datasource = None
        self._dhub = None

    def __unicode__(self):
        """Unicode representation is project and contenttype."""
        return "{0} - {1}".format(self.project, self.contenttype)

    @property
    def datasource(self):
        """The DataSource model object backing this SQLDataSource."""
        if self._datasource is None:
            self._datasource = self._get_datasource()
        return self._datasource

    @property
    def dhub(self):
        """
        The configured datahub for this data source.

        Raises ``DatasetNotFoundError`` if no dataset is found for the given
        project and contenttype. Otherwise, uses the latest dataset for that
        project and contenttype.

        """
        if self._dhub is None:
            self._dhub = self.datasource.dhub(self.procs_file_name)
        return self._dhub

    def _get_datasource(self):
        candidate_sources = []
        for source in DataSource.objects.cached():
            if (source.project == self.project and
                    source.contenttype == self.contenttype):
                candidate_sources.append(source)

        if not candidate_sources:
            raise DatasetNotFoundError(
                "No dataset found for project %r, contenttype %r."
                % (self.project, self.contenttype)
            )

        candidate_sources.sort(key=lambda s: s.dataset, reverse=True)

        return candidate_sources[0]

    def disconnect(self):
        self.dhub.disconnect()

    def create_next_dataset(self, schema_file=None):
        """
        Create and return the next dataset for this project/contenttype.

        The database for the new dataset will be located on the same host.

        """
        dataset = DataSource.objects.filter(
            project=self.project,
            contenttype=self.contenttype
        ).order_by("-dataset")[0].dataset + 1

        # @@@ should we store the schema file name used for the previous
        # dataset in the db and use the same one again automatically? or should
        # we actually copy the schema of an existing dataset rather than using
        # a schema file at all?
        return self._create_dataset(
            project=self.project,
            contenttype=self.contenttype,
            dataset=dataset,
            host=self.datasource.host,
            db_type=self.datasource.type,
            schema_file=schema_file,
        )

    @classmethod
    def create(cls, project, contenttype, host=None, name=None, db_type=None,
               schema_file=None):
        """
        Create and return a new datasource for given project/contenttype.

        Creates the database ``name`` (defaults to "project_contenttype_1") on
        host ``host`` (defaults to ``TREEHERDER_DATABASE_HOST``) and populates
        the template schema from ``schema_file`` (defaults to
        ``template_schema/schema_<contenttype>.sql``) using the db type
        ``db_type`` (defaults to "MySQL-InnoDB").

        Assumes that the database server at ``host`` is accessible, and that
        ``TREEHERDER_DATABASE_USER`` (identified by
        ``TREEHERDER_DATABASE_PASSWORD`` exists on it and has permissions to
        create databases.

        """
        if host is None:
            host = settings.TREEHERDER_DATABASE_HOST

        return cls._create_dataset(
            project=project,
            contenttype=contenttype,
            dataset=1,
            host=host,
            name=name,
            db_type=db_type,
            schema_file=schema_file,
        )

    @classmethod
    @transaction.commit_on_success
    def _create_dataset(cls, project, contenttype, dataset, host, name=None,
                        db_type=None, schema_file=None):
        """Create a new ``SQLDataSource`` and its corresponding database."""
        if name is None:
            name = "{0}_{1}_{2}".format(project, contenttype, dataset)
        if db_type is None:
            db_type = "MySQL-InnoDB"

        oauth_consumer_key = None
        oauth_consumer_secret = None

        if contenttype == 'objectstore':
            oauth_consumer_key = uuid.uuid4()
            oauth_consumer_secret = uuid.uuid4()

        ds = DataSource.objects.create(
            host=host,
            project=project,
            contenttype=contenttype,
            dataset=dataset,
            name=name,
            type=db_type,
            oauth_consumer_key=oauth_consumer_key,
            oauth_consumer_secret=oauth_consumer_secret,
            creation_date=datetime.datetime.now(),
        )

        ds.create_database(schema_file)

        sqlds = cls(project, contenttype)
        sqlds._datasource = ds
        return sqlds
