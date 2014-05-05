from __future__ import unicode_literals

import uuid
import subprocess
import os

from collections import defaultdict
import itertools

from datasource.bases.BaseHub import BaseHub
from datasource.hubs.MySQL import MySQL
from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.db.models import Max
from django.contrib.auth.models import User
from warnings import filterwarnings, resetwarnings

from jsonfield import JSONField

from treeherder import path


# the cache key is specific to the database name we're pulling the data from
SOURCES_CACHE_KEY = "treeherder-datasources"

SQL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sql')

ACTIVE_STATUS_LIST = ['active', 'onhold', 'deleted']
ACTIVE_STATUS_CHOICES = zip(ACTIVE_STATUS_LIST, ACTIVE_STATUS_LIST,)

class Product(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'product'

    def __unicode__(self):
        return self.name


class BuildPlatform(models.Model):
    id = models.AutoField(primary_key=True)
    os_name = models.CharField(max_length=25L)
    platform = models.CharField(max_length=25L)
    architecture = models.CharField(max_length=25L, blank=True)
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'build_platform'

    def __unicode__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


class Option(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'option'

    def __unicode__(self):
        return self.name


class RepositoryGroup(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'repository_group'

    def __unicode__(self):
        return self.name


class Repository(models.Model):
    id = models.AutoField(primary_key=True)
    repository_group = models.ForeignKey('RepositoryGroup')
    name = models.CharField(max_length=50L)
    dvcs_type = models.CharField(max_length=25L)
    url = models.CharField(max_length=255L)
    codebase = models.CharField(max_length=50L, blank=True)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'repository'

    def __unicode__(self):
        return "{0} {1}".format(
            self.name, self.repository_group)


class MachinePlatform(models.Model):
    id = models.AutoField(primary_key=True)
    os_name = models.CharField(max_length=25L)
    platform = models.CharField(max_length=25L)
    architecture = models.CharField(max_length=25L, blank=True)
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'machine_platform'

    def __unicode__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


class Bugscache(models.Model):
    id = models.AutoField(primary_key=True)
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
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50L)
    first_timestamp = models.IntegerField()
    last_timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'machine'

    def __unicode__(self):
        return self.name


class MachineNote(models.Model):
    id = models.AutoField(primary_key=True)
    machine = models.ForeignKey(Machine)
    author = models.CharField(max_length=50L)
    machine_timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True, default='active')
    note = models.TextField(blank=True)

    class Meta:
        db_table = 'machine_note'

    def __unicode__(self):
        return "Note {0} on {1} by {2}".format(
            self.id, self.machine, self.author)


class DatasourceManager(models.Manager):
    def cached(self):
        """
        Return all datasources, caching the results.

        """
        sources = cache.get(SOURCES_CACHE_KEY)
        if not sources:
            sources = list(self.all())
            cache.set(SOURCES_CACHE_KEY, sources)
        return sources

    def latest(self, project, contenttype):
        """
        @@@ TODO: this needs to use the cache, probably
        """
        ds = Datasource.get_latest_dataset(project, contenttype)
        return self.get(
            project=project,
            contenttype=contenttype,
            dataset=ds)


class Datasource(models.Model):
    id = models.AutoField(primary_key=True)
    project = models.CharField(max_length=50L)
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

    @classmethod
    def get_latest_dataset(cls, project, contenttype):
        """get the latest dataset"""
        return cls.objects.filter(
            project=project,
            contenttype=contenttype,
        ).aggregate(Max("dataset"))["dataset__max"]

    @property
    def key(self):
        """Unique key for a data source is the project, contenttype, dataset."""
        return "{0} - {1} - {2}".format(
            self.project, self.contenttype, self.dataset)

    def __unicode__(self):
        """Unicode representation is the project's unique key."""
        return unicode(self.key)

    def create_next_dataset(self, schema_file=None):
        """
        Create and return the next dataset for this project/contenttype.

        The database for the new dataset will be located on the same host.

        """
        dataset = Datasource.objects.filter(
            project=self.project,
            contenttype=self.contenttype
        ).order_by("-dataset")[0].dataset + 1

        # @@@ should we store the schema file name used for the previous
        # dataset in the db and use the same one again automatically? or should
        # we actually copy the schema of an existing dataset rather than using
        # a schema file at all?
        return Datasource.objects.create(
            project=self.project,
            contenttype=self.contenttype,
            dataset=dataset,
            host=self.datasource.host,
            db_type=self.datasource.type,
            schema_file=schema_file,
        )

    def save(self, *args, **kwargs):
        inserting = not self.pk
        # in case you want to add a new datasource and provide
        # a pk, set force_insert=True when you save
        if inserting or kwargs.get('force_insert', False):
            if not self.name:
                self.name = "{0}_{1}_{2}".format(
                    self.project.replace("-","_"),
                    self.contenttype,
                    self.dataset
                )

            # a database name cannot contain the dash character
            if '-' in self.name:
                self.name = self.name.replace('-','_')

            if not self.type:
                self.type = "mysql"

            self.oauth_consumer_key = None
            self.oauth_consumer_secret = None

            if self.contenttype == 'objectstore':
                self.oauth_consumer_key = uuid.uuid4()
                self.oauth_consumer_secret = uuid.uuid4()

        # validate the model before saving
        self.full_clean()

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
        filterwarnings('ignore', category=MySQLdb.Warning)
        cur = conn.cursor()
        cur.execute("CREATE DATABASE IF NOT EXISTS {0}".format(self.name))
        conn.close()
        resetwarnings()

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


class JobGroup(models.Model):
    id = models.AutoField(primary_key=True)
    symbol = models.CharField(max_length=10L, default='?')
    name = models.CharField(max_length=50L)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'job_group'

    def __unicode__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


class RepositoryVersion(models.Model):
    id = models.AutoField(primary_key=True)
    repository = models.ForeignKey(Repository)
    version = models.CharField(max_length=50L)
    version_timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'repository_version'

    def __unicode__(self):
        return "{0} version {1}".format(
            self.repository, self.version)


class OptionCollection(models.Model):
    id = models.AutoField(primary_key=True)
    option_collection_hash = models.CharField(max_length=40L)
    option = models.ForeignKey(Option)

    class Meta:
        db_table = 'option_collection'
        unique_together = ['option_collection_hash', 'option']

    def __unicode__(self):
        return "{0}".format(self.option)


class JobType(models.Model):
    id = models.AutoField(primary_key=True)
    job_group = models.ForeignKey(JobGroup, null=True, blank=True)
    symbol = models.CharField(max_length=10L, default='?')
    name = models.CharField(max_length=50L)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'job_type'

    def __unicode__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


class FailureClassification(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active')

    class Meta:
        db_table = 'failure_classification'

    def __unicode__(self):
        return self.name


# exclusion profiles models

class JobExclusion(models.Model):
    """
    A filter represents a collection of properties
    that you want to filter jobs on. These properties along with their values
    are kept in the info field in json format
    """
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    info = JSONField()
    author = models.ForeignKey(User)

    def save(self, *args, **kwargs):
        super(JobExclusion, self).save(*args, **kwargs)

        # trigger the save method on all the profiles related to this exclusion
        for profile in self.profiles.all():
            profile.save()


class ExclusionProfile(models.Model):
    """
    An exclusion profile represents a list of job exclusions that can be associated with a user profile.
    """
    name = models.CharField(max_length=255, unique=True)
    is_default = models.BooleanField(default=False)
    exclusions = models.ManyToManyField(JobExclusion, related_name="profiles")
    flat_exclusion = JSONField(blank=True, default={})
    author = models.ForeignKey(User, related_name="exclusion_profiles_authored")

    def save(self, *args, **kwargs):
        super(ExclusionProfile, self).save(*args, **kwargs)

        # prepare the nested defaultdict structure for the flat exclusions
        # options should be stored in a set but sets are not serializable.
        # using a list instead
        job_types_constructor = lambda: defaultdict(dict)
        platform_constructor = lambda: defaultdict(job_types_constructor)
        flat_exclusions = defaultdict(platform_constructor)

        for exclusion in self.exclusions.all().select_related("info"):
            # create a set of combinations for each property in the exclusion
            combo = tuple(itertools.product(exclusion.info['repos'], exclusion.info['platforms'],
                                            exclusion.info['job_types'], exclusion.info['options']))
            for repo, platform, job_type, option in combo:
                # strip the job type symbol appended in the ui
                job_type = job_type[:job_type.rfind(" (")]
                flat_exclusions[repo][platform][job_type][option] = 1

        self.flat_exclusion = flat_exclusions
        kwargs["force_insert"] = False
        kwargs["force_update"] = True
        super(ExclusionProfile, self).save(*args, **kwargs)

        # update the old default profile
        if self.is_default:
            ExclusionProfile.objects.filter(is_default=True).exclude(id=self.id).update(is_default=False)


class UserExclusionProfile(models.Model):
    """
    An extension to the standard user model that keeps the exclusion
    profile relationship.
    """

    user = models.ForeignKey(User, related_name="exclusion_profiles")
    exclusion_profile = models.ForeignKey(ExclusionProfile, blank=True, null=True)
    is_default = models.BooleanField(default=True)
