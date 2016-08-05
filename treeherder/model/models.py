from __future__ import unicode_literals

import datetime
import itertools
import os
import time
from collections import (OrderedDict,
                         defaultdict)
from hashlib import sha1
from warnings import (filterwarnings,
                      resetwarnings)

from datasource.bases.BaseHub import BaseHub
from datasource.hubs.MySQL import MySQL
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import (connection,
                       models,
                       transaction)
from django.db.models import Q
from django.forms import model_to_dict
from django.utils import timezone
from django.utils.encoding import python_2_unicode_compatible
from jsonfield import JSONField

from treeherder import path

from .fields import (BigAutoField,
                     FlexibleForeignKey)
from .search import (TestFailureLine,
                     es_connected)

# the cache key is specific to the database name we're pulling the data from
SOURCES_CACHE_KEY = "treeherder-datasources"

SQL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sql')

ACTIVE_STATUS_LIST = ['active', 'onhold', 'deleted']
ACTIVE_STATUS_CHOICES = zip(ACTIVE_STATUS_LIST, ACTIVE_STATUS_LIST,)


@python_2_unicode_compatible
class NamedModel(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.name


class Product(NamedModel):
    class Meta:
        db_table = 'product'


@python_2_unicode_compatible
class BuildPlatform(models.Model):
    id = models.AutoField(primary_key=True)
    os_name = models.CharField(max_length=25, db_index=True)
    platform = models.CharField(max_length=100, db_index=True)
    architecture = models.CharField(max_length=25, blank=True, db_index=True)
    active_status = models.CharField(max_length=7, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'build_platform'
        unique_together = ("os_name", "platform", "architecture")

    def __str__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


class Option(NamedModel):

    class Meta:
        db_table = 'option'


class RepositoryGroup(NamedModel):

    description = models.TextField(blank=True)

    class Meta:
        db_table = 'repository_group'


@python_2_unicode_compatible
class Repository(models.Model):
    id = models.AutoField(primary_key=True)
    repository_group = models.ForeignKey('RepositoryGroup')
    name = models.CharField(max_length=50, unique=True, db_index=True)
    dvcs_type = models.CharField(max_length=25, db_index=True)
    url = models.CharField(max_length=255)
    branch = models.CharField(max_length=50, null=True, db_index=True)
    codebase = models.CharField(max_length=50, blank=True, db_index=True)
    description = models.TextField(blank=True)
    active_status = models.CharField(max_length=7, blank=True, default='active', db_index=True)
    performance_alerts_enabled = models.BooleanField(default=False)

    class Meta:
        db_table = 'repository'
        verbose_name_plural = 'repositories'

    def __str__(self):
        return "{0} {1}".format(
            self.name, self.repository_group)


@python_2_unicode_compatible
class MachinePlatform(models.Model):
    id = models.AutoField(primary_key=True)
    os_name = models.CharField(max_length=25, db_index=True)
    platform = models.CharField(max_length=100, db_index=True)
    architecture = models.CharField(max_length=25, blank=True, db_index=True)
    active_status = models.CharField(max_length=7, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'machine_platform'
        unique_together = ("os_name", "platform", "architecture")

    def __str__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


@python_2_unicode_compatible
class Bugscache(models.Model):
    id = models.AutoField(primary_key=True)
    status = models.CharField(max_length=64, blank=True, db_index=True)
    resolution = models.CharField(max_length=64, blank=True, db_index=True)
    summary = models.CharField(max_length=255)
    crash_signature = models.TextField(blank=True)
    keywords = models.TextField(blank=True)
    os = models.CharField(max_length=64, blank=True)
    modified = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bugscache'
        verbose_name_plural = 'bugscache'

    def __str__(self):
        return "{0}".format(self.id)

    @classmethod
    def search(cls, search_term):
        max_size = 50
        # 90 days ago
        time_limit = datetime.datetime.now() - datetime.timedelta(days=90)
        # Wrap search term so it is used as a phrase in the full-text search.
        search_term_fulltext = search_term.join('""')
        # Substitute escape and wildcard characters, so the search term is used
        # literally in the LIKE statement.
        search_term_like = search_term.replace('=', '==').replace(
            '%', '=%').replace('_', '=_')
        recent = cls.objects.raw(
            '''
            SELECT id, summary, crash_signature, keywords, os, resolution, status,
            MATCH (`summary`) AGAINST (%s IN BOOLEAN MODE) AS relevance
            FROM bugscache
            WHERE 1
              AND resolution = ''
              AND `summary` LIKE CONCAT ('%%%%', %s, '%%%%') ESCAPE '='
              AND modified >= %s
            ORDER BY relevance DESC
            LIMIT 0,%s
            ''', [search_term_fulltext, search_term_like, time_limit,
                  max_size])

        all_others = cls.objects.raw(
            '''
            SELECT id, summary, crash_signature, keywords, os, resolution, status,
            MATCH (`summary`) AGAINST (%s IN BOOLEAN MODE) AS relevance
            FROM bugscache
            WHERE 1
            AND `summary` LIKE CONCAT ('%%%%', %s, '%%%%') ESCAPE '='
            AND (modified < %s OR resolution <> '')
            ORDER BY relevance DESC
            LIMIT 0,%s''', [search_term_fulltext, search_term_like, time_limit,
                            max_size])

        return {"open_recent": [model_to_dict(item, exclude=["modified"]) for item in recent],
                "all_others": [model_to_dict(item, exclude=["modified"]) for item in all_others]}


class Machine(NamedModel):

    class Meta:
        db_table = 'machine'


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


@python_2_unicode_compatible
class Datasource(models.Model):
    id = models.AutoField(primary_key=True)
    project = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=128, unique=True)

    objects = DatasourceManager()

    class Meta:
        db_table = 'datasource'

    @classmethod
    def reset_cache(cls):
        cache.delete(SOURCES_CACHE_KEY)
        cls.objects.cached()

    @property
    def key(self):
        """Unique key for a data source is the project."""
        return self.project

    def __str__(self):
        """Unicode representation is the project's unique key."""
        return unicode(self.key)

    def save(self, *args, **kwargs):
        inserting = not self.pk
        # in case you want to add a new datasource and provide
        # a pk, set force_insert=True when you save
        if inserting or kwargs.get('force_insert', False):
            if not self.name:
                self.name = self.project

            # a database name cannot contain the dash character
            if '-' in self.name:
                self.name = self.name.replace('-', '_')

        # validate the model before saving
        self.full_clean()

        super(Datasource, self).save(*args, **kwargs)
        if inserting:
            self.create_db()

    def dhub(self, procs_file_name):
        """
        Return a configured ``DataHub`` using the given SQL procs file.

        """
        master_host_config = {
            "host": settings.DATABASES['default']['HOST'],
            "user": settings.DATABASES['default']['USER'],
            "passwd": settings.DATABASES['default'].get('PASSWORD') or '',
        }
        if 'OPTIONS' in settings.DATABASES['default']:
            master_host_config.update(settings.DATABASES['default']['OPTIONS'])

        read_host_config = {
            "host": settings.DATABASES['read_only']['HOST'],
            "user": settings.DATABASES['read_only']['USER'],
            "passwd": settings.DATABASES['read_only'].get('PASSWORD') or '',
        }
        if 'OPTIONS' in settings.DATABASES['read_only']:
            read_host_config.update(settings.DATABASES['read_only']['OPTIONS'])

        data_source = {
            self.key: {
                "hub": "MySQL",
                "master_host": master_host_config,
                "read_host": read_host_config,
                "require_host_type": True,
                "default_db": self.name,
                "procs": [
                    os.path.join(SQL_PATH, procs_file_name),
                    os.path.join(SQL_PATH, "generic.json"),
                ],
            }
        }

        BaseHub.add_data_source(data_source)
        return MySQL(self.key)

    def create_db(self, schema_file=None):
        """
        Create the database for this source, using given SQL schema file.

        If schema file is not given, defaults to
        "template_schema/project.sql.tmpl".
        """
        import MySQLdb

        if schema_file is None:
            schema_file = path("model", "sql", "template_schema", "project.sql.tmpl")

        filterwarnings('ignore', category=MySQLdb.Warning)
        with connection.cursor() as cursor:
            cursor.execute("CREATE DATABASE IF NOT EXISTS {0}".format(self.name))
            cursor.execute("USE {0}".format(self.name))
            try:
                with open(schema_file) as f:
                    # set the engine to use
                    sql = f.read()
                    statement_list = sql.split(";")
                    for statement in statement_list:
                        cursor.execute(statement)
            finally:
                cursor.execute("USE {0}".format(
                    settings.DATABASES['default']['NAME']
                ))

        resetwarnings()

    def delete_db(self):
        with connection.cursor() as cursor:
            cursor.execute("DROP DATABASE {0}".format(self.name))

    def delete(self, *args, **kwargs):
        self.delete_db()
        super(Datasource, self).delete(*args, **kwargs)

    def truncate(self, skip_list=None):
        """
        Truncate all tables in the db self refers to.
        Skip_list is a list of table names to skip truncation.
        """
        skip_list = set(skip_list or [])

        with connection.cursor() as cursor:
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            cursor.execute("SHOW TABLES")
            for table, in cursor.fetchall():
                # if there is a skip_list, then skip any table with matching name
                if table.lower() not in skip_list:
                    # needed to use backticks around table name, because if the
                    # table name is a keyword (like "option") then this will fail
                    cursor.execute("TRUNCATE TABLE `{0}`".format(table))
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")


@python_2_unicode_compatible
class JobGroup(models.Model):
    id = models.AutoField(primary_key=True)
    symbol = models.CharField(max_length=10, default='?', db_index=True)
    name = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True)
    active_status = models.CharField(max_length=7, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'job_group'
        unique_together = ('name', 'symbol')

    def __str__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


@python_2_unicode_compatible
class OptionCollection(models.Model):
    id = models.AutoField(primary_key=True)
    option_collection_hash = models.CharField(max_length=40, db_index=True)
    option = models.ForeignKey(Option, db_index=True)

    @staticmethod
    def calculate_hash(options):
        """returns an option_collection_hash given a list of options"""
        options = sorted(list(options))
        sha_hash = sha1()
        # equivalent to loop over the options and call sha_hash.update()
        sha_hash.update(''.join(options))
        return sha_hash.hexdigest()

    class Meta:
        db_table = 'option_collection'
        unique_together = ('option_collection_hash', 'option')

    def __str__(self):
        return "{0}".format(self.option)


@python_2_unicode_compatible
class JobType(models.Model):
    id = models.AutoField(primary_key=True)
    job_group = models.ForeignKey(JobGroup, null=True, blank=True)
    symbol = models.CharField(max_length=10, default='?', db_index=True)
    name = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True)
    active_status = models.CharField(max_length=7, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'job_type'
        unique_together = (('name', 'symbol'),)

    def __str__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


class FailureClassification(NamedModel):

    class Meta:
        db_table = 'failure_classification'


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

    class Meta:
        db_table = 'job_exclusion'


class ExclusionProfile(models.Model):

    """
    An exclusion profile represents a list of job exclusions that can be associated with a user profile.
    """
    name = models.CharField(max_length=255, unique=True)
    is_default = models.BooleanField(default=False, db_index=True)
    exclusions = models.ManyToManyField(JobExclusion, related_name="profiles")
    flat_exclusion = JSONField(blank=True, default={})
    author = models.ForeignKey(User, related_name="exclusion_profiles_authored", db_index=True)
    modified = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        super(ExclusionProfile, self).save(*args, **kwargs)

        self.update_flat_exclusions()

        # update the old default profile
        if self.is_default:
            ExclusionProfile.objects.filter(is_default=True).exclude(
                id=self.id).update(is_default=False)

    def update_flat_exclusions(self):
        # this is necessary because the ``job_types`` come back in the form of
        # ``Mochitest (18)`` or ``Reftest IPC (Ripc)`` so we must split these
        # back out.
        # same deal for ``platforms``
        # todo: update if/when chunking policy changes
        # when we change chunking, we will likely only get back the name,
        # so we'll just compare that to the ``job_type_name`` field.
        def split_combo(combos):
            list1 = []
            list2 = []
            for combo in combos:
                first, sep, second = combo.rpartition(' (')
                list1.append(first)
                list2.append(second.rstrip(')'))
            return list1, list2

        query = None
        for exclusion in self.exclusions.all():
            info = exclusion.info
            option_collection_hashes = info['option_collection_hashes']
            job_type_names, job_type_symbols = split_combo(info['job_types'])
            platform_names, platform_arch = split_combo(info['platforms'])
            new_query = Q(repository__in=info['repos'],
                          machine_platform__in=platform_names,
                          job_type_name__in=job_type_names,
                          job_type_symbol__in=job_type_symbols,
                          option_collection_hash__in=option_collection_hashes)
            query = (query | new_query) if query else new_query

        self.flat_exclusion = {}

        if query:
            signatures = ReferenceDataSignatures.objects.filter(query).values_list(
                'repository', 'signature')

            self.flat_exclusion = defaultdict(list)

            # group the signatures by repo, so the queries don't have to be
            # so long when getting jobs
            for repo, sig in signatures:
                self.flat_exclusion[repo].append(sig)

        super(ExclusionProfile, self).save(
            force_insert=False,
            force_update=True
        )

    class Meta:
        db_table = 'exclusion_profile'


class UserExclusionProfile(models.Model):

    """
    An extension to the standard user model that keeps the exclusion
    profile relationship.
    """

    user = models.ForeignKey(User, related_name="exclusion_profiles")
    exclusion_profile = models.ForeignKey(ExclusionProfile, blank=True, null=True)
    is_default = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = 'user_exclusion_profile'
        unique_together = ('user', 'exclusion_profile')


class ReferenceDataSignatures(models.Model):

    """
    A collection of all the possible combinations of reference data,
    populated on data ingestion. signature is a hash of the data it refers to
    build_system_type is buildbot by default

    TODO: Rename to 'ReferenceDataSignature'.
    """
    name = models.CharField(max_length=255)
    signature = models.CharField(max_length=50, db_index=True)
    build_os_name = models.CharField(max_length=25, db_index=True)
    build_platform = models.CharField(max_length=100, db_index=True)
    build_architecture = models.CharField(max_length=25, db_index=True)
    machine_os_name = models.CharField(max_length=25, db_index=True)
    machine_platform = models.CharField(max_length=100, db_index=True)
    machine_architecture = models.CharField(max_length=25, db_index=True)
    job_group_name = models.CharField(max_length=100, blank=True, db_index=True)
    job_group_symbol = models.CharField(max_length=25, blank=True, db_index=True)
    job_type_name = models.CharField(max_length=100, db_index=True)
    job_type_symbol = models.CharField(max_length=25, blank=True, db_index=True)
    option_collection_hash = models.CharField(max_length=64, blank=True, db_index=True)
    build_system_type = models.CharField(max_length=25, blank=True, db_index=True)
    repository = models.CharField(max_length=50, db_index=True)
    first_submission_timestamp = models.IntegerField(db_index=True)

    class Meta:
        db_table = 'reference_data_signatures'
        # Remove if/when the model is renamed to 'ReferenceDataSignature'.
        verbose_name_plural = 'reference data signatures'
        unique_together = ('name', 'signature', 'build_system_type', 'repository')


class JobDuration(models.Model):
    """
    Average job duration for each repository/job signature combination.

    These are updated periodically by the calculate_durations task.
    """
    signature = models.CharField(max_length=50)
    repository = models.ForeignKey(Repository)
    average_duration = models.PositiveIntegerField()

    class Meta:
        db_table = 'job_duration'
        unique_together = ('signature', 'repository')


class Job(models.Model):
    """
    Representation of a treeherder job

    This is currently a transitional representation intended to assist in
    cross referencing data between the per-project databases and those
    objects in the Django ORM
    """
    id = BigAutoField(primary_key=True)
    repository = models.ForeignKey(Repository)
    guid = models.CharField(max_length=50, unique=True, db_index=True)
    # indexing this column to make eventual migration of performance artifacts
    # faster (since we'll need to cross-reference those row-by-row), see
    # https://bugzilla.mozilla.org/show_bug.cgi?id=1265503
    project_specific_id = models.PositiveIntegerField(db_index=True)

    class Meta:
        db_table = 'job'
        unique_together = ('repository', 'project_specific_id')

    def __str__(self):
        return "{0} {1} {2} {3}".format(self.id, self.repository, self.guid,
                                        self.project_specific_id)


class JobDetail(models.Model):
    '''
    Represents metadata associated with a job

    There can be (and usually is) more than one of these associated with
    each job
    '''
    MAX_FIELD_LENGTH = 512
    MAX_TITLE_LENGTH = 100

    id = BigAutoField(primary_key=True)
    job = FlexibleForeignKey(Job)
    title = models.CharField(max_length=MAX_TITLE_LENGTH, null=True)
    value = models.CharField(max_length=MAX_FIELD_LENGTH)
    url = models.URLField(null=True, max_length=MAX_FIELD_LENGTH)

    class Meta:
        db_table = "job_detail"
        # Ensure that we have unique records for ``job``, ``title`` and
        # ``value``.  We consider duplication in those fields with a different
        # ``url`` to be unsupported.  Unique ``url``s should also have unique
        # ``value``s.
        unique_together = ("job", "title", "value")

    def __str__(self):
        return "{0} {1} {2} {3} {4}".format(self.id,
                                            self.job.guid,
                                            self.title,
                                            self.value,
                                            self.url)


class JobLog(models.Model):
    '''
    Represents a log associated with a job

    There can be more than one of these associated with each job
    '''
    PENDING = 0
    PARSED = 1
    FAILED = 2

    STATUSES = ((PENDING, 'pending'),
                (PARSED, 'parsed'),
                (FAILED, 'failed'))

    job = FlexibleForeignKey(Job)
    name = models.CharField(max_length=50)
    url = models.URLField(max_length=255)
    status = models.IntegerField(choices=STATUSES, default=PENDING)

    class Meta:
        db_table = "job_log"
        unique_together = ('job', 'name', 'url')

    def __str__(self):
        return "{0} {1} {2} {3}".format(self.id,
                                        self.job.guid,
                                        self.name,
                                        self.status)

    def update_status(self, status):
        self.status = status
        self.save(update_fields=['status'])


class BugJobMap(models.Model):
    '''
    Maps job_ids to related bug_ids

    Mappings can be made manually through a UI or from doing lookups in the
    BugsCache
    '''
    id = BigAutoField(primary_key=True)

    job = FlexibleForeignKey(Job)
    bug_id = models.PositiveIntegerField(db_index=True)
    created = models.DateTimeField(default=timezone.now)
    user = models.ForeignKey(User, null=True)  # null if autoclassified

    class Meta:
        db_table = "bug_job_map"
        unique_together = ('job', 'bug_id')

    @property
    def who(self):
        if self.user:
            return self.user.email
        else:
            return "autoclassifier"

    def save(self, *args, **kwargs):
        super(BugJobMap, self).save(*args, **kwargs)

        # FIXME: using the JobsModel here is pretty horrible -- remove
        # when we move jobs table to central db
        from treeherder.model.derived.jobs import JobsModel
        from treeherder.etl.tasks import submit_elasticsearch_doc

        with JobsModel(self.job.repository.name) as jm:
            if settings.ORANGEFACTOR_HAWK_KEY:
                ds_job = jm.get_job(self.job.project_specific_id)[0]
                if ds_job["state"] == "completed":
                    # Submit bug associations to Elasticsearch using an async
                    # task.
                    submit_elasticsearch_doc.apply_async(
                        args=[
                            self.job.repository.name,
                            self.job.project_specific_id,
                            self.bug_id,
                            int(time.mktime(self.created.timetuple())),
                            self.who
                        ],
                        routing_key='classification_mirroring'
                    )

            # if we have a user, then update the autoclassification relations
            if self.user:
                jm.update_autoclassification_bug(self.job.project_specific_id,
                                                 self.bug_id)

    def __str__(self):
        return "{0} {1} {2} {3}".format(self.id,
                                        self.job.guid,
                                        self.bug_id,
                                        self.user)


class JobNote(models.Model):
    '''
    Note associated with a job.

    Generally these are generated manually in the UI.
    '''
    id = BigAutoField(primary_key=True)

    job = FlexibleForeignKey(Job)
    failure_classification = models.ForeignKey(FailureClassification)
    user = models.ForeignKey(User, null=True)  # null if autoclassified
    text = models.TextField()
    created = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "job_note"

    @property
    def who(self):
        if self.user:
            return self.user.email
        return "autoclassifier"

    def _update_failure_classification(self):
        # update the job classification
        from treeherder.model.derived.jobs import JobsModel
        with JobsModel(self.job.repository.name) as jm:
            jm.update_last_job_classification(self.job.project_specific_id)

        # if a manually filed job, update the autoclassification information
        if self.user:
            if self.failure_classification.name in [
                    "intermittent", "intermittent needs filing"]:
                failure_line = jm.get_manual_classification_line(
                    self.job.project_specific_id)
                if failure_line:
                    failure_line.update_autoclassification()

    def save(self, *args, **kwargs):
        super(JobNote, self).save(*args, **kwargs)
        self._update_failure_classification()

    def delete(self, *args, **kwargs):
        super(JobNote, self).delete(*args, **kwargs)
        self._update_failure_classification()

    def __str__(self):
        return "{0} {1} {2} {3}".format(self.id,
                                        self.job.guid,
                                        self.failure_classification,
                                        self.who)


class FailureLineManager(models.Manager):
    def unmatched_for_job(self, repository, job_guid):
        return FailureLine.objects.filter(
            job_guid=job_guid,
            repository__name=repository,
            classified_failures=None,
        )

    def for_jobs(self, *jobs, **filters):
        failures = FailureLine.objects.filter(job_guid__in=[item["job_guid"] for item in jobs],
                                              **filters)
        failures_by_job = defaultdict(list)
        for item in failures:
            failures_by_job[item.job_guid].append(item)
        return failures_by_job


class FailureLine(models.Model):
    # We make use of prefix indicies for several columns in this table which
    # can't be expressed in django syntax so are created with raw sql in migrations.
    STATUS_LIST = ('PASS', 'FAIL', 'OK', 'ERROR', 'TIMEOUT', 'CRASH', 'ASSERT', 'SKIP', 'NOTRUN')
    # Truncated is a special action that we use to indicate that the list of failure lines
    # was truncated according to settings.FAILURE_LINES_CUTOFF.
    ACTION_LIST = ("test_result", "log", "crash", "truncated")
    LEVEL_LIST = ("critical", "error", "warning", "info", "debug")

    ACTION_CHOICES = zip(ACTION_LIST, ACTION_LIST)
    STATUS_CHOICES = zip(STATUS_LIST, STATUS_LIST)
    LEVEL_CHOICES = zip(LEVEL_LIST, LEVEL_LIST)

    id = BigAutoField(primary_key=True)
    job_guid = models.CharField(max_length=50)
    repository = models.ForeignKey(Repository)
    job_log = FlexibleForeignKey(JobLog, null=True)
    action = models.CharField(max_length=11, choices=ACTION_CHOICES)
    line = models.PositiveIntegerField()
    test = models.TextField(blank=True, null=True)
    subtest = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=7, choices=STATUS_CHOICES)
    expected = models.CharField(max_length=7, choices=STATUS_CHOICES, blank=True, null=True)
    message = models.TextField(blank=True, null=True)
    signature = models.TextField(blank=True, null=True)  # Prefix index length 50
    level = models.CharField(max_length=8, choices=STATUS_CHOICES, blank=True, null=True)
    stack = models.TextField(blank=True, null=True)
    stackwalk_stdout = models.TextField(blank=True, null=True)
    stackwalk_stderr = models.TextField(blank=True, null=True)

    # Note that the case of best_classification = None and best_is_verified = True
    # has the special semantic that the line is ignored and should not be considered
    # for future autoclassifications.
    best_classification = FlexibleForeignKey("ClassifiedFailure",
                                             related_name="best_for_lines",
                                             null=True,
                                             db_index=True,
                                             on_delete=models.SET_NULL)

    best_is_verified = models.BooleanField(default=False)

    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    objects = FailureLineManager()
    # TODO: add indexes once we know which queries will be typically executed

    class Meta:
        db_table = 'failure_line'
        index_together = (
            ('job_guid', 'repository'),
            # The test and subtest indicies are length 50 and 25, respectively
            ('test', 'subtest', 'status', 'expected', 'created'),
            ('signature', 'test', 'created')
        )
        unique_together = (
            ('job_log',  'line')
        )

    def best_automatic_match(self, min_score=0):
        return FailureMatch.objects.filter(
            failure_line_id=self.id,
            score__gt=min_score).order_by(
            "-score",
            "-classified_failure__id").select_related(
                'classified_failure').first()

    def set_classification(self, matcher, classification=None, bug_number=None,
                           mark_best=False):
        with transaction.atomic():
            if classification is None:
                if bug_number:
                    classification, _ = ClassifiedFailure.objects.get_or_create(
                        bug_number=bug_number)
                else:
                    classification = ClassifiedFailure.objects.create()

            new_link = FailureMatch(
                failure_line=self,
                classified_failure=classification,
                matcher=matcher,
                score=1)
            new_link.save()

            if mark_best:
                self.best_classification = classification
                self.save(update_fields=['best_classification'])
            self.elastic_search_insert()
        return classification, new_link

    def mark_best_classification_verified(self, classification):
        if classification not in self.classified_failures.all():
            manual_detector = Matcher.objects.get(name="ManualDetector")
            self.set_classification(manual_detector, classification=classification)

        self.best_classification = classification
        self.best_is_verified = True
        self.save()
        self.elastic_search_insert()

    def _serialized_components(self):
        if self.action == "test_result":
            return ["TEST-UNEXPECTED-%s" % self.status.upper(),
                    self.test]
        if self.action == "log":
            return [self.level.upper(),
                    self.message.split("\n")[0]]

    def unstructured_bugs(self):
        """
        Get bugs that match this line in the Bug Suggestions artifact for this job.
        """
        components = self._serialized_components()
        if not components:
            return []

        # Importing this at the top level causes circular import misery
        from treeherder.model.derived import JobsModel, ArtifactsModel
        with JobsModel(self.repository.name) as jm, \
                ArtifactsModel(self.repository.name) as am:
            job_id = jm.get_job_ids_by_guid([self.job_guid])[self.job_guid]["id"]
            bug_suggestions = am.filter_bug_suggestions(am.bug_suggestions(job_id))

        rv = []
        ids_seen = set()
        for item in bug_suggestions:
            if all(component in item["search"] for component in components):
                for suggestion in itertools.chain(item["bugs"]["open_recent"],
                                                  item["bugs"]["all_others"]):
                    if suggestion["id"] not in ids_seen:
                        ids_seen.add(suggestion["id"])
                        rv.append(suggestion)

        return rv

    def update_autoclassification(self):
        """
        If a job is manually classified and has a single line in the logs matching a single
        FailureLine, but the FailureLine has not matched any ClassifiedFailure, add a
        new match due to the manual classification.
        """

        manual_detector = Matcher.objects.get(name="ManualDetector")

        classification, _ = self.set_classification(manual_detector)
        self.mark_best_classification_verified(classification)

    @es_connected()
    def elastic_search_insert(self):
        es_line = TestFailureLine.from_model(self)
        if es_line:
            es_line.save()
            return es_line


class ClassifiedFailure(models.Model):
    id = BigAutoField(primary_key=True)
    failure_lines = models.ManyToManyField(FailureLine, through='FailureMatch',
                                           related_name='classified_failures')
    # Note that we use a bug number of 0 as a sentinel value to indicate lines that
    # are not actually symptomatic of a real bug, but are still possible to autoclassify
    bug_number = models.PositiveIntegerField(blank=True, null=True, unique=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    def bug(self):
        # Putting this here forces one query per object; there should be a way
        # to make things more efficient
        return Bugscache.objects.filter(id=self.bug_number).first()

    def set_bug(self, bug_number):
        try:
            existing = ClassifiedFailure.objects.get(bug_number=bug_number)
            if existing == self:
                return self
            self.replace_with(existing)
            return existing
        except ClassifiedFailure.DoesNotExist:
            self.bug_number = bug_number
            self.save()
            return self

    @transaction.atomic
    def replace_with(self, other):
        # SELECT failure_match.* FROM failure_match JOIN
        # (SELECT * FROM failure_match
        #  WHERE classified_failure_id = <self.id>) AS matches
        # ON matches.classified_failure_id = <other.id> AND
        #    matches.failure_line_id = failure_match.failue_line_id
        delete_ids = []
        for match in self.matches.all():
            try:
                existing = FailureMatch.objects.get(classified_failure=other,
                                                    failure_line=match.failure_line)
                if match.score > existing.score:
                    existing.score = match.score
                    existing.save()
                delete_ids.append(match.id)
            except FailureMatch.DoesNotExist:
                match.classified_failure = other
                match.save()
        FailureMatch.objects.filter(id__in=delete_ids).delete()
        FailureLine.objects.filter(best_classification=self).update(best_classification=other)
        self.delete()

    # TODO: add indexes once we know which queries will be typically executed

    class Meta:
        db_table = 'classified_failure'


class LazyClassData(object):
    def __init__(self, type_func, setter):
        """Descriptor object for class-level data that is lazily initialized.
        See https://docs.python.org/2/howto/descriptor.html for details of the descriptor
        protocol.

        :param type_func: Callable of zero arguments used to initialize the data storage on
                          first access.
        :param setter: Callable of zero arguments used to populate the data storage
                       after it has been initialized. Unlike type_func this can safely
                       be used reentrantly i.e. the setter function may itself access the
                       attribute being set.
        """
        self.type_func = type_func
        self.setter = setter
        self.value = None

    def __get__(self, obj, objtype):
        if self.value is None:
            self.value = self.type_func()
            self.setter()
        return self.value

    def __set__(self, obj, val):
        self.value = val


def _init_matchers():
    from treeherder.autoclassify import matchers
    matchers.register()


def _init_detectors():
    from treeherder.autoclassify import detectors
    detectors.register()


class MatcherManager(models.Manager):
    _detector_funcs = LazyClassData(OrderedDict, _init_detectors)
    _matcher_funcs = LazyClassData(OrderedDict, _init_matchers)

    @classmethod
    def register_matcher(cls, matcher_cls):
        assert cls._matcher_funcs is not None
        return cls._register(matcher_cls, cls._matcher_funcs)

    @classmethod
    def register_detector(cls, detector_cls):
        assert cls._detector_funcs is not None
        return cls._register(detector_cls, cls._detector_funcs)

    @staticmethod
    def _register(cls_to_register, dest):
        # if this has already been registered, then just return the previously
        # created instance.
        if cls_to_register.__name__ in dest:
            return dest[cls_to_register.__name__]

        obj, _ = Matcher.objects.get_or_create(name=cls_to_register.__name__)

        instance = cls_to_register(obj)
        dest[cls_to_register.__name__] = instance

        return instance

    def registered_matchers(self):
        for matcher in self._matcher_funcs.values():
            yield matcher

    def registered_detectors(self):
        for matcher in self._detector_funcs.values():
            yield matcher

    def get(self, name):
        try:
            return models.Manager.get(self, name=name)
        except Matcher.DoesNotExist:
            self._matcher_funcs
            self._detector_funcs
            return models.Manager.get(self, name=name)


class Matcher(models.Model):
    name = models.CharField(max_length=50, unique=True)

    objects = MatcherManager()

    class Meta:
        db_table = 'matcher'

    def match(self, *args, **kwargs):
        if self.name in self._matcher_funcs:
            return self._matcher_funcs(*args, **kwargs)
        raise ValueError


class FailureMatch(models.Model):
    id = BigAutoField(primary_key=True)
    failure_line = FlexibleForeignKey(FailureLine,
                                      related_name="matches",
                                      on_delete=models.CASCADE)
    classified_failure = FlexibleForeignKey(ClassifiedFailure,
                                            related_name="matches",
                                            on_delete=models.CASCADE)

    matcher = models.ForeignKey(Matcher)
    score = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)

    # TODO: add indexes once we know which queries will be typically executed

    class Meta:
        db_table = 'failure_match'
        verbose_name_plural = 'failure matches'
        unique_together = (
            ('failure_line', 'classified_failure', 'matcher')
        )


@python_2_unicode_compatible
class RunnableJob(models.Model):
    id = models.AutoField(primary_key=True)
    build_platform = models.ForeignKey(BuildPlatform)
    machine_platform = models.ForeignKey(MachinePlatform)
    job_type = models.ForeignKey(JobType)
    option_collection_hash = models.CharField(max_length=64)
    ref_data_name = models.CharField(max_length=255)
    build_system_type = models.CharField(max_length=25)
    repository = models.ForeignKey(Repository)
    last_touched = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'runnable_job'
        unique_together = (
            ('ref_data_name', 'build_system_type')
        )

    def __str__(self):
        return "{0} {1} {2}".format(self.id,
                                    self.ref_data_name,
                                    self.build_system_type)


class TextLogSummary(models.Model):
    id = BigAutoField(primary_key=True)
    job_guid = models.CharField(max_length=50)
    repository = models.ForeignKey(Repository)
    text_log_summary_artifact_id = models.PositiveIntegerField(blank=True, null=True)
    bug_suggestions_artifact_id = models.PositiveIntegerField(blank=True, null=True)

    class Meta:
        db_table = 'text_log_summary'
        unique_together = (('job_guid', 'repository'))


class TextLogSummaryLine(models.Model):
    id = BigAutoField(primary_key=True)
    summary = FlexibleForeignKey(TextLogSummary, related_name="lines")
    line_number = models.PositiveIntegerField(blank=True, null=True)
    failure_line = FlexibleForeignKey(FailureLine, related_name="text_log_line", null=True)
    bug_number = models.PositiveIntegerField(blank=True, null=True)
    verified = models.BooleanField(default=False)

    def bug(self):
        # Putting this here forces one query per object; there should be a way
        # to make things more efficient
        return Bugscache.objects.filter(id=self.bug_number).first()

    class Meta:
        db_table = 'text_log_summary_line'


class TaskSetMeta(models.Model):
    id = BigAutoField(primary_key=True)
    count = models.IntegerField()
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'task_set_meta'
