from __future__ import unicode_literals

import datetime
import itertools
import logging
import time
from collections import (OrderedDict,
                         defaultdict)
from hashlib import sha1

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import (models,
                       transaction)
from django.db.models import (Q,
                              Case,
                              Count,
                              When)
from django.forms import model_to_dict
from django.utils import timezone
from django.utils.encoding import python_2_unicode_compatible
from jsonfield import JSONField

from .search import (TestFailureLine,
                     es_connected)

logger = logging.getLogger(__name__)


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
    os_name = models.CharField(max_length=25)
    platform = models.CharField(max_length=100, db_index=True)
    architecture = models.CharField(max_length=25, blank=True, db_index=True)

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
class Push(models.Model):
    '''
    A push to a repository

    A push should contain one or more commit objects, representing
    the changesets that were part of the push
    '''
    repository = models.ForeignKey(Repository)
    revision_hash = models.CharField(max_length=50, null=True)  # legacy
    # revision can be null if revision_hash defined ^^
    revision = models.CharField(max_length=40, null=True)
    author = models.CharField(max_length=150)
    time = models.DateTimeField()

    class Meta:
        db_table = 'push'
        unique_together = [('repository', 'revision'),
                           ('repository', 'revision_hash')]

    def __str__(self):
        return "{0} {1}".format(
            self.repository.name, self.revision)

    def get_status(self, exclusion_profile="default"):
        '''
        Gets a summary of what passed/failed for the push
        '''
        jobs = Job.objects.filter(push=self).filter(
            Q(failure_classification__isnull=True) |
            Q(failure_classification__name='not classified')).exclude(tier=3)
        if exclusion_profile:
            try:
                signature_list = ExclusionProfile.objects.get_signatures_for_project(
                    self.repository.name, exclusion_profile)
                jobs.exclude(signature__signature__in=signature_list)
            except ExclusionProfile.DoesNotExist:
                pass

        status_dict = {}
        total_num_coalesced = 0
        for (state, result, total, num_coalesced) in jobs.values_list(
                'state', 'result').annotate(
                    total=Count('result')).annotate(
                        num_coalesced=Count(Case(When(
                            coalesced_to_guid__isnull=False, then=1)))):
            total_num_coalesced += num_coalesced
            if state == 'completed':
                status_dict[result] = total - num_coalesced
            else:
                status_dict[state] = total
        if total_num_coalesced:
            status_dict['coalesced'] = total_num_coalesced

        return status_dict


@python_2_unicode_compatible
class Commit(models.Model):
    '''
    A single commit in a push
    '''
    push = models.ForeignKey(Push, related_name='commits')
    revision = models.CharField(max_length=40)
    author = models.CharField(max_length=150)
    comments = models.TextField()

    class Meta:
        db_table = 'commit'
        unique_together = ('push', 'revision')

    def __str__(self):
        return "{0} {1}".format(
            self.push.repository.name, self.revision)


@python_2_unicode_compatible
class MachinePlatform(models.Model):
    id = models.AutoField(primary_key=True)
    os_name = models.CharField(max_length=25)
    platform = models.CharField(max_length=100, db_index=True)
    architecture = models.CharField(max_length=25, blank=True, db_index=True)

    class Meta:
        db_table = 'machine_platform'
        unique_together = ("os_name", "platform", "architecture")

    def __str__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


@python_2_unicode_compatible
class Bugscache(models.Model):
    id = models.PositiveIntegerField(primary_key=True)
    status = models.CharField(max_length=64, db_index=True)
    resolution = models.CharField(max_length=64, blank=True, db_index=True)
    # Is covered by a FULLTEXT index created via a migrations RunSQL operation.
    summary = models.CharField(max_length=255)
    crash_signature = models.TextField(blank=True)
    keywords = models.TextField(blank=True)
    os = models.CharField(max_length=64, blank=True)
    modified = models.DateTimeField()

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
        search_term_fulltext = '"%s"' % search_term.replace("\"", "")
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


@python_2_unicode_compatible
class JobGroup(models.Model):
    id = models.AutoField(primary_key=True)
    symbol = models.CharField(max_length=25, default='?', db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'job_group'
        unique_together = ('name', 'symbol')

    def __str__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


class OptionCollectionManager(models.Manager):
    '''
    Convenience function to determine the option collection map
    '''
    def get_option_collection_map(self, options_as_list=False):
        option_collection_map = {}
        for (hash, option_name) in OptionCollection.objects.values_list(
                'option_collection_hash', 'option__name'):
            if options_as_list:
                if not option_collection_map.get(hash):
                    option_collection_map[hash] = [option_name]
                else:
                    option_collection_map[hash].append(option_name)
            else:
                if not option_collection_map.get(hash):
                    option_collection_map[hash] = option_name
                else:
                    option_collection_map[hash] += (' ' + option_name)

        return option_collection_map


@python_2_unicode_compatible
class OptionCollection(models.Model):
    id = models.AutoField(primary_key=True)
    option_collection_hash = models.CharField(max_length=40)
    option = models.ForeignKey(Option, db_index=True)

    objects = OptionCollectionManager()

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
    symbol = models.CharField(max_length=25, default='?', db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

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


class ExclusionProfileManager(models.Manager):
    """
    Convenience functions for operations on groups of exclusion profiles
    """

    def get_signatures_for_project(self, repository_name,
                                   exclusion_profile_name):
        cache_key = ExclusionProfile.get_signature_cache_key(
            exclusion_profile_name, repository_name)
        cached_signatures = cache.get(cache_key)
        if cached_signatures is not None:
            return cached_signatures

        signatures = set([])
        try:
            if exclusion_profile_name == "default":
                profile = self.get(is_default=True)
            else:
                profile = self.get(name=exclusion_profile_name)
            signatures = set(profile.get_flat_exclusions(repository_name))
        except KeyError:
            # this repo/project has no hidden signatures
            pass

        cache.set(cache_key, signatures)

        return signatures


class ExclusionProfile(models.Model):

    """
    An exclusion profile represents a list of job exclusions that can be associated with a user profile.
    """
    name = models.CharField(max_length=255, unique=True)
    is_default = models.BooleanField(default=False, db_index=True)
    exclusions = models.ManyToManyField(JobExclusion, related_name="profiles")
    author = models.ForeignKey(User, related_name="exclusion_profiles_authored", db_index=True)
    modified = models.DateTimeField(auto_now=True)

    objects = ExclusionProfileManager()

    @staticmethod
    def get_signature_cache_key(exclusion_profile_name, repository_name):
        return "exclusion-profile-signatures-{}-{}".format(
            exclusion_profile_name, repository_name)

    def save(self, *args, **kwargs):
        super(ExclusionProfile, self).save(*args, **kwargs)

        # update the old default profile
        if self.is_default:
            ExclusionProfile.objects.filter(is_default=True).exclude(
                id=self.id).update(is_default=False)

        # invalidate any existing exclusion profile cache lookups
        cache_entries_to_delete = [
            self.get_signature_cache_key(self.name, repository.name)
            for repository in Repository.objects.all()
        ]
        cache.delete_many(cache_entries_to_delete)

    def get_flat_exclusions(self, repository_name):
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

        if not query:
            return []

        return ReferenceDataSignatures.objects.filter(
            query, repository=repository_name).values_list(
                'signature', flat=True)

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

    def save(self, *args, **kwargs):
        super(ReferenceDataSignatures, self).save(*args, **kwargs)

        # if we got this far, it indicates we added or changed something,
        # so we need to invalidate any existing exclusion profile
        # cache lookups corresponding to this reference data signature's
        # repository
        cache_entries_to_delete = [
            ExclusionProfile.get_signature_cache_key(name, self.repository)
            for name in ExclusionProfile.objects.values_list('name', flat=True)
        ]
        cache.delete_many(cache_entries_to_delete)


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


class JobManager(models.Manager):
    """
    Convenience functions for operations on groups of jobs
    """

    def calculate_durations(self, repository, sample_window_seconds, debug):
        # Get the most recent timestamp from jobs
        max_start_time = self.values_list(
            'start_time', flat=True).latest('start_time')
        if not max_start_time:
            return
        latest_start_time = max_start_time - datetime.timedelta(
            seconds=sample_window_seconds)

        jobs = self.filter(repository=repository,
                           start_time__gt=latest_start_time)

        for signature_hash in jobs.values_list(
                'signature__signature', flat=True).distinct():
            # in theory we should be able to use a Django aggregation here,
            # but it doesn't seem to work:
            # http://stackoverflow.com/questions/3131107/annotate-a-queryset-with-the-average-date-difference-django#comment66231763_32856190
            num_jobs = 0
            total_time = 0.0
            for (start_time, end_time) in jobs.filter(
                    signature__signature=signature_hash).values_list(
                        'start_time', 'end_time'):
                total_time += (end_time - start_time).total_seconds()
                num_jobs += 1
            if not num_jobs:
                continue
            JobDuration.objects.update_or_create(
                signature=signature_hash,
                repository=repository,
                defaults={'average_duration': int(total_time / num_jobs)})

    def cycle_data(self, repository, cycle_interval, chunk_size, sleep_time):
        """Delete data older than cycle_interval, splitting the target data
into chunks of chunk_size size. Returns the number of result sets deleted"""
        from treeherder.model.search import bulk_delete as es_delete
        from treeherder.model.search import TestFailureLine

        # Retrieve list of jobs to delete
        jobs_max_timestamp = datetime.datetime.now() - cycle_interval
        job_guids_to_cycle = list(self.filter(
            repository=repository,
            submit_time__lt=jobs_max_timestamp).values_list('guid',
                                                            flat=True))

        if not job_guids_to_cycle:
            return 0

        # group the job in chunks
        jobs_chunk_list = zip(*[iter(job_guids_to_cycle)] * chunk_size)
        # append the remaining job data not fitting in a complete chunk
        jobs_chunk_list.append(
            job_guids_to_cycle[-(len(job_guids_to_cycle) % chunk_size):])

        for jobs_chunk in jobs_chunk_list:
            self.filter(guid__in=jobs_chunk).delete()

            # Remove ORM entries for these jobs that don't currently have a foreign key
            # relation
            failure_lines_to_delete = FailureLine.objects.filter(
                job_guid__in=jobs_chunk)
            if settings.ELASTIC_SEARCH["url"]:
                # To delete the data from elasticsearch we need both the document id and the
                # test, since this is used to determine the shard on which the document is indexed.
                # However selecting all this data can be rather slow, so split the job into multiple
                # smaller chunks.
                failure_line_max_id = failure_lines_to_delete.order_by("-id").values_list("id", flat=True).first()
                while failure_line_max_id:
                    es_delete_data = list(failure_lines_to_delete
                                          .order_by("-id")
                                          .filter(id__lte=failure_line_max_id)
                                          .values_list("id", "test")[:chunk_size])
                    if es_delete_data:
                        es_delete(TestFailureLine, es_delete_data)
                        # Compute the first possible id of a failure line not selected in the
                        # previous query
                        min_id_in_chunk, _ = es_delete_data[-1]
                        failure_line_max_id = min_id_in_chunk - 1
                    else:
                        failure_line_max_id = None
            failure_lines_to_delete.delete()

            if sleep_time:
                # Allow some time for other queries to get through
                time.sleep(sleep_time)

        return len(job_guids_to_cycle)


class Job(models.Model):
    """
    This class represents a build or test job in Treeherder
    """
    INCOMPLETE_STATES = ["running", "pending"]
    STATES = INCOMPLETE_STATES + ["completed", "coalesced"]

    objects = JobManager()

    id = models.BigAutoField(primary_key=True)

    PENDING = 0
    CROSSREFERENCED = 1
    AUTOCLASSIFIED = 2
    SKIPPED = 3
    FAILED = 255

    AUTOCLASSIFY_STATUSES = ((PENDING, 'pending'),
                             (CROSSREFERENCED, 'crossreferenced'),
                             (AUTOCLASSIFIED, 'autoclassified'),
                             (SKIPPED, 'skipped'),
                             (FAILED, 'failed'))

    repository = models.ForeignKey(Repository)
    guid = models.CharField(max_length=50, unique=True)
    project_specific_id = models.PositiveIntegerField(null=True)

    coalesced_to_guid = models.CharField(max_length=50, null=True,
                                         default=None)
    signature = models.ForeignKey(ReferenceDataSignatures)
    build_platform = models.ForeignKey(BuildPlatform)
    machine_platform = models.ForeignKey(MachinePlatform)
    machine = models.ForeignKey(Machine)
    option_collection_hash = models.CharField(max_length=64)
    job_type = models.ForeignKey(JobType)
    product = models.ForeignKey(Product)
    failure_classification = models.ForeignKey(FailureClassification)
    who = models.CharField(max_length=50)
    reason = models.CharField(max_length=125)
    result = models.CharField(max_length=25)
    state = models.CharField(max_length=25)

    submit_time = models.DateTimeField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    last_modified = models.DateTimeField(auto_now=True, db_index=True)
    running_eta = models.PositiveIntegerField(null=True, default=None)
    tier = models.PositiveIntegerField()

    push = models.ForeignKey(Push)

    class Meta:
        db_table = 'job'
        unique_together = ('repository', 'project_specific_id')
        index_together = [
            # these speed up the various permutations of the "similar jobs"
            # queries
            ('repository', 'job_type', 'start_time'),
            ('repository', 'build_platform', 'job_type', 'start_time'),
            ('repository', 'option_collection_hash', 'job_type', 'start_time'),
            ('repository', 'build_platform', 'option_collection_hash',
             'job_type', 'start_time'),
            # this is intended to speed up queries for specific platform /
            # option collections on a push
            ('machine_platform', 'option_collection_hash', 'push'),
        ]

    def __str__(self):
        return "{0} {1} {2} {3}".format(self.id, self.repository, self.guid,
                                        self.project_specific_id)

    def get_platform_option(self):
        if not hasattr(self, 'platform_option'):
            self.platform_option = ''
            option_hash = self.option_collection_hash
            if option_hash:
                option_collection_map = OptionCollection.objects.get_option_collection_map()
                self.platform_option = option_collection_map.get(option_hash)

        return self.platform_option

    def save(self, *args, **kwargs):
        self.last_modified = datetime.datetime.now()
        super(Job, self).save(*args, **kwargs)

    def is_fully_autoclassified(self):
        """
        Returns whether a job is fully autoclassified (i.e. we have
        classification information for all failure lines)
        """
        if FailureLine.objects.filter(job_guid=self.guid,
                                      action="truncated").count() > 0:
            return False

        classified_error_count = TextLogError.objects.filter(
            best_classification__isnull=False,
            step__job=self).count()

        if classified_error_count == 0:
            return False

        from treeherder.model.error_summary import get_filtered_error_lines

        return classified_error_count == len(get_filtered_error_lines(self))

    def is_fully_verified(self):
        # Line is not fully verified if there are either structured failure lines
        # with no best failure, or unverified unstructured lines not associated with
        # a structured line

        unverified_errors = TextLogError.objects.filter(
            best_is_verified=False,
            step__job=self).count()

        if unverified_errors:
            logger.error("Job %r has unverified TextLogErrors" % self)
            return False

        logger.info("Job %r is fully verified" % self)
        return True

    def update_after_verification(self, user):
        """
        Updates a job's state after being verified by a sheriff
        """
        if not settings.AUTOCLASSIFY_JOBS:
            return

        if self.is_fully_verified():
            existing_notes = JobNote.objects.filter(job=self)
            autoclassification = FailureClassification.objects.get(
                name="autoclassified intermittent")
            # We don't want to add a job note after an autoclassification if
            # there is already one and after a verification if there is
            # already one not supplied by the autoclassifier
            for note in existing_notes:
                if note.failure_classification != autoclassification:
                    return
            JobNote.objects.create_autoclassify_job_note(self, user=user)

    def get_manual_classification_line(self):
        """
        Return the TextLogError from a job if it can be manually classified as a side effect
        of the overall job being classified.
        Otherwise return None.
        """
        try:
            text_log_errors = [TextLogError.objects.get(step__job=self)]
        except (TextLogError.DoesNotExist, TextLogError.MultipleObjectsReturned):
            return None

        # Only propagate the classification if there is exactly one unstructured failure
        # line for the job
        from treeherder.model.error_summary import get_filtered_error_lines
        if len(get_filtered_error_lines(self)) != 1:
            return None

        # Check that some detector would match this. This is being used as an indication
        # that the autoclassifier will be able to work on this classification
        if not any(detector(text_log_errors)
                   for detector in Matcher.objects.registered_detectors()):
            return None

        return text_log_errors[0]

    def update_autoclassification_bug(self, bug_number):
        text_log_error = self.get_manual_classification_line()

        if text_log_error is None:
            return

        classification = text_log_error.best_classification
        if classification and classification.bug_number is None:
            return classification.set_bug(bug_number)


class JobDetail(models.Model):
    '''
    Represents metadata associated with a job

    There can be (and usually is) more than one of these associated with
    each job
    '''

    id = models.BigAutoField(primary_key=True)
    job = models.ForeignKey(Job)
    title = models.CharField(max_length=70, null=True)
    value = models.CharField(max_length=125)
    url = models.URLField(null=True, max_length=512)

    class Meta:
        db_table = "job_detail"
        unique_together = ("title", "value", "job")

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

    job = models.ForeignKey(Job)
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
    id = models.BigAutoField(primary_key=True)

    job = models.ForeignKey(Job)
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

        from treeherder.etl.tasks import submit_elasticsearch_doc

        if settings.ORANGEFACTOR_HAWK_KEY:
            if self.job.state == "completed":
                # Submit bug associations to Elasticsearch using an async
                # task.
                submit_elasticsearch_doc.apply_async(
                    args=[
                        self.job.repository.name,
                        self.job.id,
                        self.bug_id,
                        int(time.mktime(self.created.timetuple())),
                        self.who
                    ],
                    routing_key='classification_mirroring'
                )

        # if we have a user, then update the autoclassification relations
        if self.user:
            self.job.update_autoclassification_bug(self.bug_id)

    def __str__(self):
        return "{0} {1} {2} {3}".format(self.id,
                                        self.job.guid,
                                        self.bug_id,
                                        self.user)


class JobNoteManager(models.Manager):
    '''
    Convenience functions for creating / modifying groups of job notes
    '''
    def create_autoclassify_job_note(self, job, user=None):

        # Only insert bugs for verified failures since these are automatically
        # mirrored to ES and the mirroring can't be undone
        bug_numbers = set(ClassifiedFailure.objects
                          .filter(best_for_errors__step__job=job,
                                  best_for_errors__best_is_verified=True)
                          .exclude(bug_number=None)
                          .values_list('bug_number', flat=True))

        # Legacy
        bug_numbers |= set(TextLogSummaryLine.objects
                           .filter(summary__job_guid=job.guid,
                                   verified=True)
                           .exclude(bug_number=None)
                           .values_list('bug_number', flat=True))

        for bug_number in bug_numbers:
            BugJobMap.objects.get_or_create(job=job,
                                            bug_id=bug_number,
                                            defaults={
                                                'user': user
                                            })

        # if user is not specified, then this is an autoclassified job note
        # and we should mark it as such
        if user is None:
            classification = FailureClassification.objects.get(
                name="autoclassified intermittent")
        else:
            classification = FailureClassification.objects.get(name="intermittent")

        return JobNote.objects.create(job=job,
                                      failure_classification=classification,
                                      user=user,
                                      text="")


class JobNote(models.Model):
    '''
    Note associated with a job.

    Generally these are generated manually in the UI.
    '''
    id = models.BigAutoField(primary_key=True)

    job = models.ForeignKey(Job)
    failure_classification = models.ForeignKey(FailureClassification)
    user = models.ForeignKey(User, null=True)  # null if autoclassified
    text = models.TextField()
    created = models.DateTimeField(default=timezone.now)

    objects = JobNoteManager()

    class Meta:
        db_table = "job_note"

    @property
    def who(self):
        if self.user:
            return self.user.email
        return "autoclassifier"

    def _update_failure_classification(self):
        # update the job classification
        note = JobNote.objects.filter(job=self.job).order_by('-created').first()
        if note:
            self.job.failure_classification_id = note.failure_classification.id
        else:
            self.job.failure_classification_id = FailureClassification.objects.values_list(
                'id', flat=True).get(name='not classified')
        self.job.save()

        # if a manually filed job, update the autoclassification information
        if not self.user:
            return

        if self.failure_classification.name not in [
                "intermittent", "intermittent needs filing"]:
            return

        text_log_error = self.job.get_manual_classification_line()
        if not text_log_error:
            return
        bug_numbers = set(BugJobMap.objects
                          .filter(job=self.job)
                          .values_list('bug_id', flat=True))

        existing_bugs = set(ClassifiedFailure.objects
                            .filter(error_matches__text_log_error=text_log_error)
                            .values_list('bug_number', flat=True))

        add_bugs = (bug_numbers - existing_bugs)
        if not add_bugs:
            return

        manual_detector = Matcher.objects.get(name="ManualDetector")
        for bug_number in add_bugs:
            classification, _ = text_log_error.set_classification(manual_detector,
                                                                  bug_number=bug_number)
        if len(add_bugs) == 1 and not existing_bugs:
            text_log_error.mark_best_classification_verified(classification)

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

    id = models.BigAutoField(primary_key=True)
    job_guid = models.CharField(max_length=50)
    repository = models.ForeignKey(Repository)
    job_log = models.ForeignKey(JobLog, null=True)
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

    # Note that the case of best_classification = None and best_is_verified = True
    # has the special semantic that the line is ignored and should not be considered
    # for future autoclassifications.
    best_classification = models.ForeignKey("ClassifiedFailure",
                                            related_name="best_for_lines",
                                            null=True,
                                            db_index=True,
                                            on_delete=models.SET_NULL)

    best_is_verified = models.BooleanField(default=False)

    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'failure_line'
        index_together = (
            ('job_guid', 'repository'),
            # Prefix index: test(50), subtest(25), status, expected, created
            ('test', 'subtest', 'status', 'expected', 'created'),
            # Prefix index: signature(25), test(50), created
            ('signature', 'test', 'created')
        )
        unique_together = (
            ('job_log',  'line')
        )

    def __str__(self):
        return "{0} {1}".format(self.id, Job.objects.get(guid=self.job_guid).id)

    @property
    def error(self):
        # Return the related text-log-error or None if there is no related field.
        try:
            return self.text_log_error
        except TextLogError.DoesNotExist:
            return None

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

            if self.error:
                TextLogErrorMatch.objects.create(
                    text_log_error=self.error,
                    classified_failure=classification,
                    matcher=matcher,
                    score=1)
                if mark_best:
                    self.error.best_classification = classification
                    self.error.save(update_fields=['best_classification'])

            self.elastic_search_insert()
        return classification, new_link

    def mark_best_classification_verified(self, classification):
        if classification not in self.classified_failures.all():
            manual_detector = Matcher.objects.get(name="ManualDetector")
            self.set_classification(manual_detector, classification=classification)

        self.best_classification = classification
        self.best_is_verified = True
        self.save()
        if self.error:
            self.error.best_classification = classification
            self.error.best_is_verified = True
            self.error.save(update_fields=["best_classification", "best_is_verified"])
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

        from treeherder.model.error_summary import get_filtered_error_lines
        job = Job.objects.get(guid=self.job_guid)
        rv = []
        ids_seen = set()
        for item in get_filtered_error_lines(job):
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
    id = models.BigAutoField(primary_key=True)
    failure_lines = models.ManyToManyField(FailureLine, through='FailureMatch',
                                           related_name='classified_failures')
    text_log_errors = models.ManyToManyField("TextLogError", through='TextLogErrorMatch',
                                             related_name='classified_failures')
    # Note that we use a bug number of 0 as a sentinel value to indicate lines that
    # are not actually symptomatic of a real bug, but are still possible to autoclassify
    bug_number = models.PositiveIntegerField(blank=True, null=True, unique=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "{0} {1}".format(self.id, self.bug_number)

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
    id = models.BigAutoField(primary_key=True)
    failure_line = models.ForeignKey(FailureLine,
                                     related_name="matches",
                                     on_delete=models.CASCADE)
    classified_failure = models.ForeignKey(ClassifiedFailure,
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

    def __str__(self):
        return "{0} {1}".format(
            self.failure_line.id, self.classified_failure.id)


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


class TextLogStep(models.Model):
    """
    An individual step in the textual (unstructured) log
    """
    id = models.BigAutoField(primary_key=True)

    job = models.ForeignKey(Job)

    # these are presently based off of buildbot results
    # (and duplicated in treeherder/etl/buildbot.py)
    SUCCESS = 0
    TEST_FAILED = 1
    BUSTED = 2
    SKIPPED = 3
    EXCEPTION = 4
    RETRY = 5
    USERCANCEL = 6
    UNKNOWN = 7

    RESULTS = ((SUCCESS, 'success'),
               (TEST_FAILED, 'testfailed'),
               (BUSTED, 'busted'),
               (SKIPPED, 'skipped'),
               (EXCEPTION, 'exception'),
               (RETRY, 'retry'),
               (USERCANCEL, 'usercancel'),
               (UNKNOWN, 'unknown'))

    name = models.CharField(max_length=200)
    started = models.DateTimeField(null=True)
    finished = models.DateTimeField(null=True)
    started_line_number = models.PositiveIntegerField()
    finished_line_number = models.PositiveIntegerField()
    result = models.IntegerField(choices=RESULTS)

    class Meta:
        db_table = "text_log_step"
        unique_together = ('job', 'started_line_number',
                           'finished_line_number')


class TextLogErrorManager(models.Manager):
    def unmatched_for_job(self, job):
        return TextLogError.objects.filter(
            step__job=job,
            classified_failures=None,
        ).prefetch_related('step', 'failure_line')

    def for_jobs(self, *jobs, **filters):
        error_lines = TextLogError.objects.filter(
            step__job__in=jobs,
            **filters)
        lines_by_job = defaultdict(list)
        for item in error_lines:
            lines_by_job[item.step.job].append(item)
        return lines_by_job


class TextLogError(models.Model):
    """
    A detected error line in the textual (unstructured) log
    """
    id = models.BigAutoField(primary_key=True)

    step = models.ForeignKey(TextLogStep, related_name='errors')
    line = models.TextField()
    line_number = models.PositiveIntegerField()
    failure_line = models.OneToOneField(FailureLine,
                                        related_name="text_log_error",
                                        null=True)
    # Note that the case of best_classification = None and best_is_verified = True
    # has the special semantic that the line is ignored and should not be considered
    # for future autoclassifications.
    best_classification = models.ForeignKey("ClassifiedFailure",
                                            related_name="best_for_errors",
                                            null=True,
                                            db_index=True,
                                            on_delete=models.SET_NULL)
    best_is_verified = models.BooleanField(default=False)

    objects = TextLogErrorManager()

    class Meta:
        db_table = "text_log_error"
        unique_together = ('step', 'line_number')

    def __str__(self):
        return "{0} {1}".format(self.id, self.step.job.id)

    def bug_suggestions(self):
        from treeherder.model import error_summary
        return error_summary.bug_suggestions_line(self)

    def best_automatic_match(self, min_score=0):
        return (TextLogErrorMatch.objects
                .filter(text_log_error__id=self.id,
                        score__gt=min_score)
                .order_by("-score",
                          "-classified_failure_id")
                .select_related('classified_failure')
                .first())

    def set_classification(self, matcher, classification=None, bug_number=None,
                           mark_best=False):
        with transaction.atomic():
            if classification is None:
                if bug_number:
                    classification, _ = ClassifiedFailure.objects.get_or_create(
                        bug_number=bug_number)
                else:
                    classification = ClassifiedFailure.objects.create()

            new_link = TextLogErrorMatch(
                text_log_error=self,
                classified_failure=classification,
                matcher=matcher,
                score=1)
            new_link.save()

            if self.failure_line:
                new_link_failure = FailureMatch(
                    failure_line=self.failure_line,
                    classified_failure=classification,
                    matcher=matcher,
                    score=1)
                new_link_failure.save()

            if mark_best:
                self.mark_best_classification(classification)

        return classification, new_link

    def mark_best_classification(self, classification):
        self.best_classification = classification
        self.save(update_fields=['best_classification'])
        if self.failure_line:
            self.failure_line.best_classification = classification
            self.failure_line.save(update_fields=['best_classification'])

            self.failure_line.elastic_search_insert()

    def mark_best_classification_verified(self, classification):
        if classification not in self.classified_failures.all():
            manual_detector = Matcher.objects.get(name="ManualDetector")
            self.set_classification(manual_detector, classification=classification)

        self.best_classification = classification
        self.best_is_verified = True
        self.save()
        if self.failure_line:
            self.failure_line.best_classification = classification
            self.failure_line.best_is_verified = True
            self.failure_line.save()
            self.failure_line.elastic_search_insert()

    def update_autoclassification(self):
        """
        If a job is manually classified and has a single line in the logs matching a single
        TextLogError, but the TextLogError has not matched any ClassifiedFailure, add a
        new match due to the manual classification.
        """

        manual_detector = Matcher.objects.get(name="ManualDetector")

        classification, _ = self.set_classification(manual_detector)
        self.mark_best_classification_verified(classification)


class TextLogErrorMatch(models.Model):
    id = models.BigAutoField(primary_key=True)
    text_log_error = models.ForeignKey(TextLogError,
                                       related_name="matches",
                                       on_delete=models.CASCADE)
    classified_failure = models.ForeignKey(ClassifiedFailure,
                                           related_name="error_matches",
                                           on_delete=models.CASCADE)

    matcher = models.ForeignKey(Matcher)
    score = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)

    class Meta:
        db_table = 'text_log_error_match'
        verbose_name_plural = 'text log error matches'
        unique_together = (
            ('text_log_error', 'classified_failure', 'matcher')
        )

    def __str__(self):
        return "{0} {1}".format(
            self.text_log_error.id, self.classified_failure.id)


class TextLogSummary(models.Model):
    """
    An intermediate class correlating artifact + text log data with
    structured failure line data

    This is a legacy model that doesn't serve much useful purpose.
    Should probably be removed at some point.
    """
    id = models.BigAutoField(primary_key=True)
    job_guid = models.CharField(max_length=50)
    repository = models.ForeignKey(Repository)
    text_log_summary_artifact_id = models.PositiveIntegerField(blank=True, null=True)
    bug_suggestions_artifact_id = models.PositiveIntegerField(blank=True, null=True)

    class Meta:
        db_table = 'text_log_summary'
        unique_together = (('job_guid', 'repository'))


class TextLogSummaryLine(models.Model):
    """
    An intermediate class correlating failure lines with text log error lines

    This probably should be merged with TextLogError above (but isn't yet for
    legacy reasons)
    """
    id = models.BigAutoField(primary_key=True)
    summary = models.ForeignKey(TextLogSummary, related_name="lines")
    line_number = models.PositiveIntegerField(blank=True, null=True)
    failure_line = models.ForeignKey(FailureLine, related_name="text_log_line", null=True)
    bug_number = models.PositiveIntegerField(blank=True, null=True)
    verified = models.BooleanField(default=False)

    def bug(self):
        # Putting this here forces one query per object; there should be a way
        # to make things more efficient
        return Bugscache.objects.filter(id=self.bug_number).first()

    class Meta:
        db_table = 'text_log_summary_line'
