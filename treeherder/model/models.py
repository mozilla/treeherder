from __future__ import unicode_literals

import os
import uuid
from collections import (OrderedDict,
                         defaultdict)
from warnings import (filterwarnings,
                      resetwarnings)

from datasource.bases.BaseHub import BaseHub
from datasource.hubs.MySQL import MySQL
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import (connection,
                       models)
from django.db.models import Q
from django.utils.encoding import python_2_unicode_compatible
from jsonfield import JSONField

from treeherder import path

from .fields import (BigAutoField,
                     FlexibleForeignKey)

# the cache key is specific to the database name we're pulling the data from
SOURCES_CACHE_KEY = "treeherder-datasources"
REPOSITORY_LIST_CACHE_KEY = 'treeherder-repositories'
FAILURE_CLASSIFICAION_LIST_CACHE_KEY = 'treeherder-failure-classifications'

SQL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sql')

ACTIVE_STATUS_LIST = ['active', 'onhold', 'deleted']
ACTIVE_STATUS_CHOICES = zip(ACTIVE_STATUS_LIST, ACTIVE_STATUS_LIST,)


@python_2_unicode_compatible
class NamedModel(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50L, db_index=True)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active', db_index=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.name


class Product(NamedModel):
    class Meta:
        db_table = 'product'


class Device(NamedModel):
    class Meta:
        db_table = 'device'


@python_2_unicode_compatible
class BuildPlatform(models.Model):
    id = models.AutoField(primary_key=True)
    os_name = models.CharField(max_length=25L, db_index=True)
    platform = models.CharField(max_length=25L, db_index=True)
    architecture = models.CharField(max_length=25L, blank=True, db_index=True)
    active_status = models.CharField(max_length=7L, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'build_platform'

    def __str__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


class Option(NamedModel):

    class Meta:
        db_table = 'option'


class RepositoryGroup(NamedModel):

    class Meta:
        db_table = 'repository_group'


@python_2_unicode_compatible
class Repository(models.Model):
    id = models.AutoField(primary_key=True)
    repository_group = models.ForeignKey('RepositoryGroup')
    name = models.CharField(max_length=50L, db_index=True)
    dvcs_type = models.CharField(max_length=25L, db_index=True)
    url = models.CharField(max_length=255L)
    codebase = models.CharField(max_length=50L, blank=True, db_index=True)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'repository'

    def __str__(self):
        return "{0} {1}".format(
            self.name, self.repository_group)


@python_2_unicode_compatible
class MachinePlatform(models.Model):
    id = models.AutoField(primary_key=True)
    os_name = models.CharField(max_length=25L, db_index=True)
    platform = models.CharField(max_length=25L, db_index=True)
    architecture = models.CharField(max_length=25L, blank=True, db_index=True)
    active_status = models.CharField(max_length=7L, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'machine_platform'

    def __str__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


@python_2_unicode_compatible
class Bugscache(models.Model):
    id = models.AutoField(primary_key=True)
    status = models.CharField(max_length=64L, blank=True, db_index=True)
    resolution = models.CharField(max_length=64L, blank=True, db_index=True)
    summary = models.CharField(max_length=255L)
    crash_signature = models.TextField(blank=True)
    keywords = models.TextField(blank=True)
    os = models.CharField(max_length=64L, blank=True)
    modified = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bugscache'

    def __str__(self):
        return "{0}".format(self.id)


@python_2_unicode_compatible
class Machine(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50L, db_index=True)
    first_timestamp = models.IntegerField(db_index=True)
    last_timestamp = models.IntegerField(db_index=True)
    active_status = models.CharField(max_length=7L, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'machine'

    def __str__(self):
        return self.name


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
    project = models.CharField(max_length=50L, unique=True)
    name = models.CharField(max_length=128L, unique=True)
    oauth_consumer_key = models.CharField(max_length=45L, blank=True, null=True)
    oauth_consumer_secret = models.CharField(max_length=45L, blank=True, null=True)

    objects = DatasourceManager()

    class Meta:
        db_table = 'datasource'

    @classmethod
    def reset_cache(cls):
        cache.delete(SOURCES_CACHE_KEY)
        cache.delete(REPOSITORY_LIST_CACHE_KEY)
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
        master_host_config = {
            "host": settings.DATABASES['default']['HOST'],
            "user": settings.DATABASES['default']['USER'],
            "passwd": settings.DATABASES['default']['PASSWORD'],
        }
        if 'OPTIONS' in settings.DATABASES['default']:
            master_host_config.update(settings.DATABASES['default']['OPTIONS'])

        read_host_config = {
            "host": settings.DATABASES['read_only']['HOST'],
            "user": settings.DATABASES['read_only']['USER'],
            "passwd": settings.DATABASES['read_only']['PASSWORD'],
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
    symbol = models.CharField(max_length=10L, default='?', db_index=True)
    name = models.CharField(max_length=50L, db_index=True)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active', db_index=True)

    class Meta:
        db_table = 'job_group'

    def __str__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


@python_2_unicode_compatible
class OptionCollection(models.Model):
    id = models.AutoField(primary_key=True)
    option_collection_hash = models.CharField(max_length=40L, db_index=True)
    option = models.ForeignKey(Option, db_index=True)

    class Meta:
        db_table = 'option_collection'
        unique_together = ('option_collection_hash', 'option')

    def __str__(self):
        return "{0}".format(self.option)


@python_2_unicode_compatible
class JobType(models.Model):
    id = models.AutoField(primary_key=True)
    job_group = models.ForeignKey(JobGroup, null=True, blank=True)
    symbol = models.CharField(max_length=10L, default='?', db_index=True)
    name = models.CharField(max_length=50L, db_index=True)
    description = models.TextField(blank=True, default='fill me')
    active_status = models.CharField(max_length=7L, blank=True, default='active', db_index=True)

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


class ReferenceDataSignatures(models.Model):

    """
    A collection of all the possible combinations of reference data,
    populated on data ingestion. signature is a hash of the data it refers to
    build_system_type is buildbot by default
    """
    name = models.CharField(max_length=255L)
    signature = models.CharField(max_length=50L, db_index=True)
    build_os_name = models.CharField(max_length=25L, db_index=True)
    build_platform = models.CharField(max_length=25L, db_index=True)
    build_architecture = models.CharField(max_length=25L, db_index=True)
    machine_os_name = models.CharField(max_length=25L, db_index=True)
    machine_platform = models.CharField(max_length=25L, db_index=True)
    machine_architecture = models.CharField(max_length=25L, db_index=True)
    device_name = models.CharField(max_length=50L, db_index=True)
    job_group_name = models.CharField(max_length=100L, blank=True, db_index=True)
    job_group_symbol = models.CharField(max_length=25L, blank=True, db_index=True)
    job_type_name = models.CharField(max_length=100L, db_index=True)
    job_type_symbol = models.CharField(max_length=25L, blank=True, db_index=True)
    option_collection_hash = models.CharField(max_length=64L, blank=True, db_index=True)
    build_system_type = models.CharField(max_length=25L, blank=True, db_index=True)
    repository = models.CharField(max_length=50L, db_index=True)
    first_submission_timestamp = models.IntegerField(db_index=True)
    review_timestamp = models.IntegerField(null=True, blank=True, db_index=True)
    review_status = models.CharField(max_length=12L, blank=True, db_index=True)

    class Meta:
        db_table = 'reference_data_signatures'


class FailureLineManager(models.Manager):
    def unmatched_for_job(self, repository, job_guid):
        return FailureLine.objects.filter(
            job_guid=job_guid,
            repository__name=repository,
            classified_failures=None,
        )

    def for_jobs(self, *jobs):
        failures = FailureLine.objects.filter(job_guid__in=[item["job_guid"] for item in jobs])
        failures_by_job = defaultdict(list)
        for item in failures:
            failures_by_job[item.job_guid].append(item)
        return failures_by_job


class FailureLine(models.Model):
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
    action = models.CharField(max_length=11, choices=ACTION_CHOICES)
    line = models.PositiveIntegerField()
    test = models.TextField(blank=True, null=True)
    subtest = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=7, choices=STATUS_CHOICES)
    expected = models.CharField(max_length=7, choices=STATUS_CHOICES, blank=True, null=True)
    message = models.TextField(blank=True, null=True)
    signature = models.TextField(blank=True, null=True)
    level = models.CharField(max_length=8, choices=STATUS_CHOICES, blank=True, null=True)
    stack = models.TextField(blank=True, null=True)
    stackwalk_stdout = models.TextField(blank=True, null=True)
    stackwalk_stderr = models.TextField(blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    objects = FailureLineManager()
    # TODO: add indexes once we know which queries will be typically executed

    class Meta:
        db_table = 'failure_line'
        unique_together = (
            ('job_guid', 'line')
        )

    def best_match(self, min_score=0):
        match = FailureMatch.objects.filter(failure_line_id=self.id).order_by(
            "-score",
            "-classified_failure__modified").first()

        if match and match.score > min_score:
            return match

    def create_new_classification(self, matcher):
        new_classification = ClassifiedFailure()
        new_classification.save()

        new_link = FailureMatch(
            failure_line=self,
            classified_failure=new_classification,
            matcher=matcher,
            score=1,
            is_best=True)
        new_link.save()


class ClassifiedFailure(models.Model):
    id = BigAutoField(primary_key=True)
    failure_lines = models.ManyToManyField(FailureLine, through='FailureMatch',
                                           related_name='classified_failures')
    bug_number = models.PositiveIntegerField(blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    # TODO: add indexes once we know which queries will be typically executed

    class Meta:
        db_table = 'classified_failure'


class MatcherManager(models.Manager):
    def register_matcher(self, cls):
        return self._register(cls, Matcher._matcher_funcs)

    def register_detector(self, cls):
        return self._register(cls, Matcher._detector_funcs)

    def _register(self, cls, dest):
        if cls.__name__ in dest:
            return dest[cls.__name__]

        obj = Matcher.objects.get_or_create(name=cls.__name__)[0]

        instance = cls(obj)
        dest[cls.__name__] = instance

        return instance

    def registered_matchers(self):
        for matcher in Matcher._matcher_funcs.values():
            yield matcher

    def registered_detectors(self):
        for matcher in Matcher._detector_funcs.values():
            yield matcher


class Matcher(models.Model):
    name = models.CharField(max_length=50, unique=True)

    _detector_funcs = OrderedDict()
    _matcher_funcs = OrderedDict()

    objects = MatcherManager()

    class Meta:
        db_table = 'matcher'

    def match(self, *args, **kwargs):
        if self.name in self._matcher_funcs:
            return self._matcher_funcs(*args, **kwargs)
        raise ValueError


class FailureMatch(models.Model):
    id = BigAutoField(primary_key=True)
    failure_line = FlexibleForeignKey(FailureLine, related_name="matches")
    classified_failure = FlexibleForeignKey(ClassifiedFailure)
    matcher = models.ForeignKey(Matcher)
    score = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    is_best = models.BooleanField(default=False)

    # TODO: add indexes once we know which queries will be typically executed

    class Meta:
        db_table = 'failure_match'
        unique_together = (
            ('failure_line', 'classified_failure', 'matcher')
        )
