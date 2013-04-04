from __future__ import unicode_literals

import uuid
import subprocess
import os
import json
import MySQLdb

from warnings import filterwarnings, resetwarnings

from django.conf import settings
from django.core.cache import cache
from django.db import models

from treeherder import path
import utils

# the cache key is specific to the database name we're pulling the data from
SOURCES_CACHE_KEY = "treeherder-datasources"

SQL_PATH = os.path.dirname(os.path.abspath(__file__))


class Product(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'product'

    def __unicode__(self):
        return self.name


class BuildPlatform(models.Model):
    id = models.IntegerField(primary_key=True)
    os_name = models.CharField(max_length=25L)
    platform = models.CharField(max_length=25L)
    architecture = models.CharField(max_length=25L, blank=True)
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'build_platform'

    def __unicode__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


class Option(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'option'

    def __unicode__(self):
        return self.name


class RepositoryGroup(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'repository_group'

    def __unicode__(self):
        return self.name


class Repository(models.Model):
    id = models.IntegerField(primary_key=True)
    repository_group = models.ForeignKey('RepositoryGroup')
    name = models.CharField(max_length=50L)
    type = models.CharField(max_length=25L)
    url = models.CharField(max_length=255L)
    branch = models.CharField(max_length=50L, blank=True)
    project_name = models.CharField(max_length=25L, blank=True)
    description = models.TextField()
    purpose = models.CharField(max_length=50L)
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'repository'

    def __unicode__(self):
        return "{0} {1}".format(
            self.name, self.repository_group)


class MachinePlatform(models.Model):
    id = models.IntegerField(primary_key=True)
    os_name = models.CharField(max_length=25L)
    platform = models.CharField(max_length=25L)
    architecture = models.CharField(max_length=25L, blank=True)
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'machine_platform'

    def __unicode__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


class Bugscache(models.Model):
    id = models.IntegerField(primary_key=True)
    status = models.CharField(max_length=64L, blank=True)
    resolution = models.CharField(max_length=64L, blank=True)
    summary = models.CharField(max_length=255L)
    crash_signature = models.TextField(blank=True)
    keywords = models.TextField(blank=True)
    os = models.CharField(max_length=64L, blank=True)
    modified = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bugscache'

    def __unicode__(self):
        return "{0}".format(self.id)


class Machine(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    first_timestamp = models.IntegerField()
    last_timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'machine'

    def __unicode__(self):
        return self.name


class MachineNote(models.Model):
    id = models.IntegerField(primary_key=True)
    machine = models.ForeignKey(Machine)
    author = models.CharField(max_length=50L)
    machine_timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        db_table = 'machine_note'

    def __unicode__(self):
        return "Note {0} on {1} by {2}".format(
            self.id, self.machine, self.author)


class DatasourceManager(models.Manager):
    def cached(self):
        """Return all datasources, caching the results."""
        sources = cache.get(SOURCES_CACHE_KEY)
        if not sources:
            sources = list(self.all())
            cache.set(SOURCES_CACHE_KEY, sources)
        return sources


class Datasource(models.Model):
    id = models.IntegerField(primary_key=True)
    project = models.CharField(max_length=25L)
    contenttype = models.CharField(max_length=25L)
    dataset = models.IntegerField()
    host = models.CharField(max_length=128L)
    read_only_host = models.CharField(max_length=128L, blank=True)
    name = models.CharField(max_length=128L)
    type = models.CharField(max_length=25L)
    oauth_consumer_key = models.CharField(max_length=45L, blank=True, null=True)
    oauth_consumer_secret = models.CharField(max_length=45L, blank=True, null=True)
    creation_date = models.DateTimeField(auto_now_add=True)

    objects = DatasourceManager()

    class Meta:
        db_table = 'datasource'
        unique_together = [
            ["project", "dataset", "contenttype"],
            ["host", "name"],
        ]

    @classmethod
    def reset_cache(cls):
        cache.delete(SOURCES_CACHE_KEY)
        cls.objects.cached()

    @property
    def key(self):
        """Unique key for a data source is the project, contenttype, dataset."""
        return "{0} - {1} - {2}".format(
            self.project, self.contenttype, self.dataset)

    def __unicode__(self):
        """Unicode representation is the project's unique key."""
        return unicode(self.key)

    def save(self, *args, **kwargs):
        inserting = not self.pk
        # in case you want to add a new datasource and provide
        # a pk, set force_insert=True when you save
        if inserting or kwargs.get('force_insert',False):
            if not self.name:
                self.name = "{0}_{1}_{2}".format(
                    self.project,
                    self.contenttype,
                    self.dataset
                )
            if not self.type:
                self.type = "mysql"

            self.oauth_consumer_key = None
            self.oauth_consumer_secret = None

            if self.contenttype == 'objectstore':
                self.oauth_consumer_key = uuid.uuid4()
                self.oauth_consumer_secret = uuid.uuid4()

        super(Datasource, self).save(*args, **kwargs)
        if inserting:
            self.create_db()

    def get_oauth_consumer_secret(self, key):
        """
        Return the oauth consumer secret if the key provided matches the
        the consumer key.
        """
        oauth_consumer_secret = None
        if self.oauth_consumer_key == key:
            oauth_consumer_secret = self.oauth_consumer_secret
        return oauth_consumer_secret

    def dhub(self, procs_file_name):
        """
        Return a configured ``DataHub`` using the given SQL procs file.

        """
        data_source = {
            self.key: {
                # @@@ this should depend on self.type
                # @@@ shouldn't have to specify this here and below
                "hub": "MySQL",
                "master_host": {
                    "host": self.host,
                    "user": settings.TREEHERDER_DATABASE_USER,
                    "passwd": settings.TREEHERDER_DATABASE_PASSWORD,
                    },
                "default_db": self.name,
                "procs": [
                    os.path.join(SQL_PATH, procs_file_name),
                    os.path.join(SQL_PATH, "generic.json"),
                    ],
                }
            }

        if self.read_only_host:
            data_source[self.key]['read_host'] = {
                "host": self.read_only_host,
                "user": settings.TREEHERDER_RO_DATABASE_USER,
                "passwd": settings.TREEHERDER_RO_DATABASE_PASSWORD,
                }

        BaseHub.add_data_source(data_source)
        # @@@ the datahub class should depend on self.type
        return MySQL(self.key)

    def create_db(self, schema_file=None):
        """
        Create the database for this source, using given SQL schema file.

        If schema file is not given, defaults to
        "template_schema/schema_<contenttype>.sql.tmpl".

        Assumes that the database server at ``self.host`` is accessible, and
        that ``DATABASE_USER`` (identified by
        ``DATABASE_PASSWORD`` exists on it and has permissions to
        create databases.
        """
        from django.conf import settings
        import MySQLdb
        DB_USER = settings.DATABASES["default"]["USER"]
        DB_PASS = settings.DATABASES["default"]["PASSWORD"]
        if self.type.lower().startswith("mysql-"):
            engine = self.type[len("mysql-"):]
        elif self.type.lower() == "mysql":
            engine = "InnoDB"
        else:
            raise NotImplementedError(
                "Currently only MySQL data source is supported.")

        if schema_file is None:
            schema_file = path(
                "model",
                "sql",
                "template_schema",
                "project_{0}_1.sql.tmpl".format(self.contenttype),
            )

        conn = MySQLdb.connect(
            host=self.host,
            user=DB_USER,
            passwd=DB_PASS,
        )
        cur = conn.cursor()
        cur.execute("CREATE DATABASE {0}".format(self.name))
        conn.close()

        # MySQLdb provides no way to execute an entire SQL file in bulk, so we
        # have to shell out to the commandline client.
        with open(schema_file) as f:
            # set the engine to use
            sql = f.read().format(engine=engine)

        args = [
            "mysql",
            "--host={0}".format(self.host),
            "--user={0}".format(DB_USER),
        ]
        if DB_PASS:
            args.append(
                "--password={0}".format(
                    DB_PASS)
            )
        args.append(self.name)
        proc = subprocess.Popen(
            args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        (output, _) = proc.communicate(sql)
        if proc.returncode:
            raise IOError(
                "Unable to set up schema for datasource {0}: "
                "mysql returned code {1}, output follows:\n\n{2}".format(
                    self.key, proc.returncode, output
                )
            )

    def delete_db(self):
        from django.conf import settings
        import MySQLdb
        DB_USER = settings.DATABASES["default"]["USER"]
        DB_PASS = settings.DATABASES["default"]["PASSWORD"]
        conn = MySQLdb.connect(
            host=self.host,
            user=DB_USER,
            passwd=DB_PASS,
        )
        cur = conn.cursor()
        cur.execute("DROP DATABASE {0}".format(self.name))
        conn.close()

    def delete(self, *args, **kwargs):
        self.delete_db()
        super(Datasource, self).delete(*args, **kwargs)

    def truncate(self, skip_list=None):
        """
        Truncate all tables in the db self refers to.
        Skip_list is a list of table names to skip truncation.
        """
        from django.conf import settings
        import MySQLdb

        skip_list = set(skip_list or [])

        DB_USER = settings.DATABASES["default"]["USER"]
        DB_PASS = settings.DATABASES["default"]["PASSWORD"]

        conn = MySQLdb.connect(
            host=self.host,
            user=DB_USER,
            passwd=DB_PASS,
            db=self.name,
        )
        cur = conn.cursor()
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        cur.execute("SHOW TABLES")

        for table, in cur.fetchall():
            # if there is a skip_list, then skip any table with matching name
            if table.lower() not in skip_list:
                # needed to use backticks around table name, because if the
                # table name is a keyword (like "option") then this will fail
                cur.execute("TRUNCATE TABLE `{0}`".format(table))

        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.close()



class JobsModel(object):
    """
    Represent a job repository with objectstore

    content-types:
        jobs
        objectstore

    """

    # content types that every project will have
    CT_JOBS = "jobs"
    CT_OBJECTSTORE = "objectstore"
    CONTENT_TYPES = [CT_JOBS, CT_OBJECTSTORE]

    def __init__(self, project):
        self.project = project

        self.sources = {}
        for ct in self.CONTENT_TYPES:
            self.sources[ct] = Datasource(project, ct)

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


    @classmethod
    def create(cls, project, hosts=None, types=None):
        """
        Create all the datasource tables for this project.

        ``hosts`` is an optional dictionary mapping contenttype names to the
        database server host on which the database for that contenttype should
        be created. Not all contenttypes need to be represented; any that
        aren't will use the default (``TREEHERDER_DATABASE_HOST``).

        ``types`` is an optional dictionary mapping contenttype names to the
        type of database that should be created. For MySQL/MariaDB databases,
        use "MySQL-Engine", where "Engine" could be "InnoDB", "Aria", etc. Not
        all contenttypes need to be represented; any that aren't will use the
        default (``MySQL-InnoDB``).


        """
        hosts = hosts or {}
        types = types or {}

        for ct in cls.CONTENT_TYPES:
            Datasource.create(
                project,
                ct,
                host=hosts.get(ct),
                db_type=types.get(ct),
            )

        return cls(project=project)


    def get_oauth_consumer_secret(self, key):
        ds = self.sources[self.CT_OBJECTSTORE].datasource
        secret = ds.get_oauth_consumer_secret(key)
        return secret


    def _get_last_insert_id(self, source=None):
        """Return last-inserted ID."""
        if not source:
            source = self.CT_JOBS
        return self.sources[source].dhub.execute(
            proc='generic.selects.get_last_insert_id',
            debug_show=self.DEBUG,
            return_type='iter',
        ).get_column_data('id')


    def store_job_data(self, json_data, error=None):
        """Write the JSON to the objectstore to be queued for processing."""

        date_loaded = utils.get_now_timestamp()
        error_flag = "N" if error is None else "Y"
        error_msg = error or ""

        self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc='objectstore.inserts.store_json',
            placeholders=[date_loaded, json_data, error_flag, error_msg],
            debug_show=self.DEBUG
        )

        return self._get_last_insert_id()


    def retrieve_job_data(self, limit):
        """
        Retrieve JSON blobs from the objectstore.

        Does not claim rows for processing; should not be used for actually
        processing JSON blobs into perftest schema.

        Used only by the `transfer_data` management command.

        """
        proc = "objectstore.selects.get_unprocessed"
        json_blobs = self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc=proc,
            placeholders=[limit],
            debug_show=self.DEBUG,
            return_type='tuple'
        )

        return json_blobs


    def load_job_data(self, data):
        """Load JobData instance into jobs db, return test_run_id."""

        # Apply all platform specific hacks to account for mozilla
        # production test environment problems
        self._adapt_production_data(data)

        # Get/Set reference info, all inserts use ON DUPLICATE KEY
        test_id = self._get_or_create_test_id(data)
        os_id = self._get_or_create_os_id(data)
        product_id = self._get_or_create_product_id(data)
        machine_id = self._get_or_create_machine_id(data, os_id)

        # Insert build and test_run data.
        build_id = self._get_or_create_build_id(data, product_id)

        test_run_id = self._set_test_run_data(
            data,
            test_id,
            build_id,
            machine_id
        )

        self._set_option_data(data, test_run_id)
        self._set_test_values(data, test_id, test_run_id)
        self._set_test_aux_data(data, test_id, test_run_id)

        # Make project specific changes
        self._adapt_project_specific_data(data, test_run_id)

        return test_run_id


    def process_objects(self, loadlimit):
        """Processes JSON blobs from the objectstore into perftest schema."""
        rows = self.claim_objects(loadlimit)
        test_run_ids_loaded = []

        for row in rows:
            row_id = int(row['id'])
            try:
                data = JobData.from_json(row['json_blob'])
                test_run_id = self.load_job_data(data)
            except JobDataError as e:
                self.mark_object_error(row_id, str(e))
            except Exception as e:
                self.mark_object_error(
                    row_id,
                    u"Unknown error: {0}: {1}".format(
                        e.__class__.__name__, unicode(e))
                )
            else:
                self.mark_object_complete(row_id, test_run_id)
                test_run_ids_loaded.append(test_run_id)

        return test_run_ids_loaded


    def claim_objects(self, limit):
        """
        Claim & return up to ``limit`` unprocessed blobs from the objectstore.

        Returns a tuple of dictionaries with "json_blob" and "id" keys.

        May return more than ``limit`` rows if there are existing orphaned rows
        that were claimed by an earlier connection with the same connection ID
        but never completed.

        """
        proc_mark = 'objectstore.updates.mark_loading'
        proc_get = 'objectstore.selects.get_claimed'

        # Note: There is a bug in MySQL http://bugs.mysql.com/bug.php?id=42415
        # that causes the following warning to be generated in the production
        # environment:
        #
        # _mysql_exceptions.Warning: Unsafe statement written to the binary
        # log using statement format since BINLOG_FORMAT = STATEMENT. The
        # statement is unsafe because it uses a LIMIT clause. This is
        # unsafe because the set of rows included cannot be predicted.
        #
        # I have been unable to generate the warning in the development
        # environment because the warning is specific to the master/slave
        # replication environment which only exists in production.In the
        # production environment the generation of this warning is causing
        # the program to exit.
        #
        # The mark_loading SQL statement does execute an UPDATE/LIMIT but now
        # implements an "ORDER BY id" clause making the UPDATE
        # deterministic/safe.  I've been unsuccessfull capturing the specific
        # warning generated without redirecting program flow control.  To
        # ressolve the problem in production, we're disabling MySQLdb.Warnings
        # before executing mark_loading and then re-enabling warnings
        # immediately after.  If this bug is ever fixed in mysql this handling
        # should be removed. Holy Hackery! -Jeads
        filterwarnings('ignore', category=MySQLdb.Warning)

        # Note: this claims rows for processing. Failure to call load_job_data
        # on this data will result in some json blobs being stuck in limbo
        # until another worker comes along with the same connection ID.
        self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc=proc_mark,
            placeholders=[limit],
            debug_show=self.DEBUG,
        )

        resetwarnings()

        # Return all JSON blobs claimed by this connection ID (could possibly
        # include orphaned rows from a previous run).
        json_blobs = self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc=proc_get,
            debug_show=self.DEBUG,
            return_type='tuple'
        )

        return json_blobs


    def mark_object_complete(self, object_id, test_run_id):
        """ Call to database to mark the task completed """
        self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc="objectstore.updates.mark_complete",
            placeholders=[test_run_id, object_id],
            debug_show=self.DEBUG
        )


    def mark_object_error(self, object_id, error):
        """ Call to database to mark the task completed """
        self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc="objectstore.updates.mark_error",
            placeholders=[error, object_id],
            debug_show=self.DEBUG
        )


class JobDataError(ValueError):
    pass


class JobData(dict):
    """
    Encapsulates data access from incoming test data structure.

    All missing-data errors raise ``JobDataError`` with a useful
    message. Unlike regular nested dictionaries, ``JobData`` keeps track of
    context, so errors contain not only the name of the immediately-missing
    key, but the full parent-key context as well.

    """
    def __init__(self, data, context=None):
        """Initialize ``JobData`` with a data dict and a context list."""
        self.context = context or []
        super(JobData, self).__init__(data)


    @classmethod
    def from_json(cls, json_blob):
        """Create ``JobData`` from a JSON string."""
        try:
            data = json.loads(json_blob)
        except ValueError as e:
            raise JobDataError("Malformed JSON: {0}".format(e))

        return cls(data)


    def __getitem__(self, name):
        """Get a data value, raising ``JobDataError`` if missing."""
        full_context = list(self.context) + [name]

        try:
            value = super(JobData, self).__getitem__(name)
        except KeyError:
            raise JobDataError("Missing data: {0}.".format(
                "".join(["['{0}']".format(c) for c in full_context])))

        # Provide the same behavior recursively to nested dictionaries.
        if isinstance(value, dict):
            value = self.__class__(value, full_context)

        return value



class JobGroup(models.Model):
    id = models.IntegerField(primary_key=True)
    symbol = models.CharField(max_length=10L)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'job_group'

    def __unicode__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


class RepositoryVersion(models.Model):
    id = models.IntegerField(primary_key=True)
    repository = models.ForeignKey(Repository)
    version = models.CharField(max_length=50L)
    timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'repository_version'

    def __unicode__(self):
        return "{0} version {1}".format(
            self.repository, self.version)


class OptionCollection(models.Model):
    id = models.IntegerField(primary_key=True)
    option = models.ForeignKey(Option)

    class Meta:
        db_table = 'option_collection'
        unique_together = ['id', 'option']

    def __unicode__(self):
        return "{0}".format(self.option)


class JobType(models.Model):
    id = models.IntegerField(primary_key=True)
    job_group = models.ForeignKey(JobGroup, null=True, blank=True)
    symbol = models.CharField(max_length=10L)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'job_type'

    def __unicode__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


class FailureClassification(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'failure_classification'

    def __unicode__(self):
        return self.name
