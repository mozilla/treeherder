from __future__ import unicode_literals

import datetime
import itertools
import logging
import time
from collections import OrderedDict
from hashlib import sha1

import newrelic.agent
from django.conf import settings
from django.contrib.auth.models import User
from django.core.validators import MinLengthValidator
from django.db import (models,
                       transaction)
from django.db.models import (Count,
                              Q)
from django.forms import model_to_dict
from django.utils import timezone
from django.utils.encoding import python_2_unicode_compatible

from ..services.elasticsearch import (bulk,
                                      index)
from ..utils.queryset import chunked_qs

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
    repository_group = models.ForeignKey('RepositoryGroup', on_delete=models.CASCADE)
    name = models.CharField(max_length=50, unique=True, db_index=True)
    dvcs_type = models.CharField(max_length=25, db_index=True)
    url = models.CharField(max_length=255)
    branch = models.CharField(max_length=50, null=True, db_index=True)
    codebase = models.CharField(max_length=50, blank=True, db_index=True)
    description = models.TextField(blank=True)
    active_status = models.CharField(max_length=7, blank=True, default='active', db_index=True)
    performance_alerts_enabled = models.BooleanField(default=False)
    expire_performance_data = models.BooleanField(default=True)
    is_try_repo = models.BooleanField(default=False)

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
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    revision = models.CharField(max_length=40)
    author = models.CharField(max_length=150)
    time = models.DateTimeField(db_index=True)

    class Meta:
        db_table = 'push'
        unique_together = ('repository', 'revision')

    def __str__(self):
        return "{0} {1}".format(
            self.repository.name, self.revision)

    def get_status(self):
        '''
        Gets a summary of what passed/failed for the push
        '''
        jobs = Job.objects.filter(push=self).filter(
            Q(failure_classification__isnull=True) |
            Q(failure_classification__name='not classified')).exclude(tier=3)

        status_dict = {}
        for (state, result, total) in jobs.values_list(
                'state', 'result').annotate(
                    total=Count('result')):
            if state == 'completed':
                status_dict[result] = total
            else:
                status_dict[state] = total
        if 'superseded' in status_dict:
            # backward compatability for API consumers
            status_dict['coalesced'] = status_dict['superseded']

        return status_dict


@python_2_unicode_compatible
class Commit(models.Model):
    '''
    A single commit in a push
    '''
    push = models.ForeignKey(Push, on_delete=models.CASCADE, related_name='commits')
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
    whiteboard = models.CharField(max_length=100, blank=True, default='')

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
    option = models.ForeignKey(Option, on_delete=models.CASCADE, db_index=True)

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


class JobManager(models.Manager):
    """
    Convenience functions for operations on groups of jobs
    """

    def cycle_data(self, repository, cycle_interval, chunk_size, sleep_time):
        """
        Delete data older than cycle_interval, splitting the target data into
        chunks of chunk_size size. Returns the number of result sets deleted
        """

        # Retrieve list of jobs to delete
        jobs_max_timestamp = datetime.datetime.now() - cycle_interval

        jobs_cycled = 0
        while True:
            jobs_chunk = list(self.filter(repository=repository, submit_time__lt=jobs_max_timestamp)
                                  .values_list('guid', flat=True)[:chunk_size])

            if not jobs_chunk:
                # no more jobs to cycle, we're done!
                return jobs_cycled

            # Remove ORM entries for these jobs that don't currently have a
            # foreign key relation
            lines = FailureLine.objects.filter(job_guid__in=jobs_chunk)

            if settings.ELASTICSEARCH_URL:
                # To delete the data from elasticsearch we need the document
                # id.  However selecting all this data can be rather slow, so
                # split the job into multiple smaller chunks.

                failures = itertools.chain.from_iterable(
                    chunked_qs(
                        lines,
                        chunk_size=chunk_size,
                        fields=['id', 'test'],
                    ),
                )
                bulk(failures, action='delete')

            lines.delete()

            # cycle jobs *after* related data has been deleted, to be sure
            # we don't have any orphan data
            self.filter(guid__in=jobs_chunk).delete()

            jobs_cycled += len(jobs_chunk)

            if sleep_time:
                # Allow some time for other queries to get through
                time.sleep(sleep_time)


class Job(models.Model):
    """
    This class represents a build or test job in Treeherder
    """
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

    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    guid = models.CharField(max_length=50, unique=True)
    project_specific_id = models.PositiveIntegerField(null=True)  # unused, see bug 1328985
    autoclassify_status = models.IntegerField(choices=AUTOCLASSIFY_STATUSES, default=PENDING)

    # TODO: Remove coalesced_to_guid next time the jobs table is modified (bug 1402992)
    coalesced_to_guid = models.CharField(max_length=50, null=True,
                                         default=None)
    signature = models.ForeignKey(ReferenceDataSignatures, on_delete=models.CASCADE)
    build_platform = models.ForeignKey(BuildPlatform, on_delete=models.CASCADE, related_name='jobs')
    machine_platform = models.ForeignKey(MachinePlatform, on_delete=models.CASCADE)
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE)
    option_collection_hash = models.CharField(max_length=64)
    job_type = models.ForeignKey(JobType, on_delete=models.CASCADE, related_name='jobs')
    job_group = models.ForeignKey(JobGroup, on_delete=models.CASCADE, related_name='jobs')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    failure_classification = models.ForeignKey(FailureClassification, on_delete=models.CASCADE, related_name='jobs')
    who = models.CharField(max_length=50)
    reason = models.CharField(max_length=125)
    result = models.CharField(max_length=25)
    state = models.CharField(max_length=25)

    submit_time = models.DateTimeField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    last_modified = models.DateTimeField(auto_now=True, db_index=True)
    # TODO: Remove next time we add/drop another field.
    running_eta = models.PositiveIntegerField(null=True, default=None)
    tier = models.PositiveIntegerField()

    push = models.ForeignKey(Push, on_delete=models.CASCADE, related_name='jobs')

    class Meta:
        db_table = 'job'
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
            # speed up cycle data
            ('repository', 'submit_time'),
        ]

    def __str__(self):
        return "{0} {1} {2}".format(self.id, self.repository, self.guid)

    def get_platform_option(self, option_collection_map=None):
        if not hasattr(self, 'platform_option'):
            self.platform_option = ''
            option_hash = self.option_collection_hash
            if option_hash:
                if not option_collection_map:
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
            _metadata__best_classification__isnull=False,
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
            _metadata__best_is_verified=False,
            step__job=self).count()

        if unverified_errors:
            logger.error("Job %r has unverified TextLogErrors", self)
            return False

        logger.info("Job %r is fully verified", self)
        return True

    def update_after_verification(self, user):
        """
        Updates a job's state after being verified by a sheriff
        """
        if not settings.AUTOCLASSIFY_JOBS:
            return

        if not self.is_fully_verified():
            return

        classification = 'autoclassified intermittent'

        already_classified = (JobNote.objects.filter(job=self)
                                             .exclude(failure_classification__name=classification)
                                             .exists())
        if already_classified:
            # Don't add an autoclassification note if a Human already
            # classified this job.
            return

        # Send event to NewRelic when a verifing an autoclassified failure.
        matches = TextLogErrorMatch.objects.filter(text_log_error__step__job=self)
        for match in matches:
            newrelic.agent.record_custom_event('user_verified_classification', {
                'matcher': match.matcher_name,
                'job_id': self.id,
            })

        JobNote.create_autoclassify_job_note(job=self, user=user)

    def get_manual_classification_line(self):
        """
        Return the TextLogError from a job if it can be manually classified as a side effect
        of the overall job being classified.
        Otherwise return None.
        """
        try:
            text_log_error = TextLogError.objects.get(step__job=self)
        except (TextLogError.DoesNotExist, TextLogError.MultipleObjectsReturned):
            return None

        # Only propagate the classification if there is exactly one unstructured failure
        # line for the job
        from treeherder.model.error_summary import get_filtered_error_lines
        if len(get_filtered_error_lines(self)) != 1:
            return None

        # Check that we have a related FailureLine and it's in a state we
        # expect for auto-classification.
        failure_line = text_log_error.get_failure_line()
        if failure_line is None:
            return None

        if not (failure_line.action == "test_result" and
                failure_line.test and
                failure_line.status and
                failure_line.expected):
            return None

        return text_log_error

    def update_autoclassification_bug(self, bug_number):
        text_log_error = self.get_manual_classification_line()

        if text_log_error is None:
            return

        classification = (text_log_error.metadata.best_classification if text_log_error.metadata
                          else None)
        if classification and classification.bug_number is None:
            return classification.set_bug(bug_number)


class TaskclusterMetadata(models.Model):
    '''
    Taskcluster-specific metadata associated with a taskcluster job
    '''
    job = models.OneToOneField(
        Job,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='taskcluster_metadata'
    )

    task_id = models.CharField(max_length=22,
                               validators=[MinLengthValidator(22)])
    retry_id = models.PositiveIntegerField()

    class Meta:
        db_table = "taskcluster_metadata"


@python_2_unicode_compatible
class JobDetail(models.Model):
    '''
    Represents metadata associated with a job

    There can be (and usually is) more than one of these associated with
    each job
    '''

    id = models.BigAutoField(primary_key=True)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="job_details")
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

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="job_log")
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


class FailuresQuerySet(models.QuerySet):
    def default(self, repo, startday, endday):
        return self.select_related('push', 'job').filter(
               job__repository_id__in=repo, job__push__time__range=(startday, endday))

    def by_bug(self, bug_id):
        return self.filter(bug_id=int(bug_id))


class BugJobMap(models.Model):
    '''
    Maps job_ids to related bug_ids

    Mappings can be made manually through a UI or from doing lookups in the
    BugsCache
    '''
    id = models.BigAutoField(primary_key=True)

    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    bug_id = models.PositiveIntegerField(db_index=True)
    created = models.DateTimeField(default=timezone.now)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)  # null if autoclassified

    failures = FailuresQuerySet.as_manager()
    objects = models.Manager()

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

        from treeherder.etl.tasks.classification_mirroring_tasks import submit_elasticsearch_doc

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


class JobNote(models.Model):
    '''
    Note associated with a job.

    Generally these are generated manually in the UI.
    '''
    id = models.BigAutoField(primary_key=True)

    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    failure_classification = models.ForeignKey(FailureClassification, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)  # null if autoclassified
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

        for bug_number in add_bugs:
            classification, _ = text_log_error.set_classification("ManualDetector",
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

    @classmethod
    def create_autoclassify_job_note(self, job, user=None):

        # Only insert bugs for verified failures since these are automatically
        # mirrored to ES and the mirroring can't be undone
        bug_numbers = set(ClassifiedFailure.objects
                          .filter(best_for_errors__text_log_error__step__job=job,
                                  best_for_errors__best_is_verified=True)
                          .exclude(bug_number=None)
                          .exclude(bug_number=0)
                          .values_list('bug_number', flat=True))

        for bug_number in bug_numbers:
            BugJobMap.objects.get_or_create(job=job,
                                            bug_id=bug_number,
                                            defaults={
                                                'user': user
                                            })

        # if user is not specified, then this is an autoclassified job note and
        # we should mark it as such
        classification_name = 'intermittent' if user else 'autoclassified intermittent'
        classification = FailureClassification.objects.get(name=classification_name)

        return JobNote.objects.create(job=job,
                                      failure_classification=classification,
                                      user=user,
                                      text="")


class FailureLine(models.Model):
    # We make use of prefix indicies for several columns in this table which
    # can't be expressed in django syntax so are created with raw sql in migrations.
    STATUS_LIST = ('PASS', 'FAIL', 'OK', 'ERROR', 'TIMEOUT', 'CRASH', 'ASSERT', 'SKIP', 'NOTRUN')
    # Truncated is a special action that we use to indicate that the list of failure lines
    # was truncated according to settings.FAILURE_LINES_CUTOFF.
    ACTION_LIST = ("test_result", "log", "crash", "truncated")
    LEVEL_LIST = ("critical", "error", "warning", "info", "debug")

    # Python 3's zip produces an iterable rather than a list, which Django's `choices` can't handle.
    ACTION_CHOICES = list(zip(ACTION_LIST, ACTION_LIST))
    STATUS_CHOICES = list(zip(STATUS_LIST, STATUS_LIST))
    LEVEL_CHOICES = list(zip(LEVEL_LIST, LEVEL_LIST))

    id = models.BigAutoField(primary_key=True)
    job_guid = models.CharField(max_length=50)
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    job_log = models.ForeignKey(JobLog, on_delete=models.CASCADE, null=True, related_name="failure_line")
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
            ('job_log', 'line')
        )

    def __str__(self):
        return "{0} {1}".format(self.id, Job.objects.get(guid=self.job_guid).id)

    @property
    def error(self):
        # Return the related text-log-error or None if there is no related field.
        try:
            return self.text_log_error_metadata.text_log_error
        except TextLogErrorMetadata.DoesNotExist:
            return None

    def best_automatic_match(self, min_score=0):
        """Find the best related match above a given minimum score."""
        return (self.matches.filter(score__gt=min_score)
                            .order_by("-score", "-classified_failure__id")
                            .select_related('classified_failure')
                            .first())

    def set_classification(self, matcher_name, classification=None, bug_number=None,
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
                matcher_name=matcher_name,
                score=1)
            new_link.save()

            if mark_best:
                self.best_classification = classification
                self.save(update_fields=['best_classification'])

            if self.error:
                TextLogErrorMatch.objects.create(
                    text_log_error=self.error,
                    classified_failure=classification,
                    matcher_name=matcher_name,
                    score=1)
                if mark_best:
                    self.error.metadata.best_classification = classification
                    self.error.metadata.save(update_fields=['best_classification'])

            self.elastic_search_insert()
        return classification, new_link

    def mark_best_classification_verified(self, classification):
        if (classification and
            classification.id not in self.classified_failures.values_list('id', flat=True)):
            logger.debug("Adding new classification to TextLogError")
            self.set_classification("ManualDetector", classification=classification)

        self.best_classification = classification
        self.best_is_verified = True
        self.save()
        if self.error:
            self.error.metadata.best_classification = classification
            self.error.metadata.best_is_verified = True
            self.error.metadata.save(update_fields=["best_classification", "best_is_verified"])
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
        classification, _ = self.set_classification("ManualDetector")
        self.mark_best_classification_verified(classification)

    def elastic_search_insert(self):
        if not settings.ELASTICSEARCH_URL:
            return

        index(self)

    def to_dict(self):
        return {
            'id': self.id,
            'job_guid': self.job_guid,
            'repository': self.repository_id,
            'job_log': self.job_log_id,
            'action': self.action,
            'line': self.line,
            'test': self.test,
            'subtest': self.subtest,
            'status': self.status,
            'expected': self.expected,
            'message': self.message,
            'signature': self.signature,
            'level': self.level,
            'stack': self.stack,
            'stackwalk_stdout': self.stackwalk_stdout,
            'stackwalk_stderr': self.stackwalk_stderr,
            'best_classification': self.best_classification_id,
            'best_is_verified': self.best_is_verified,
            'created': self.created,
            'modified': self.modified,
        }


class Group(models.Model):
    """
    The test harness group.

    This is most often a manifest file.  But in some instances where a suite
    doesn't have manifests, or a test suite isn't logging its data properly,
    this can simply be "default"

    Note: This is not to be confused with JobGroup which is Treeherder specific.
    """
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)
    failure_lines = models.ManyToManyField(FailureLine,
                                           related_name='group')

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'group'


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
        for Match, key, matches in [(TextLogErrorMatch, "text_log_error",
                                     self.error_matches.all()),
                                    (FailureMatch, "failure_line",
                                     self.matches.all())]:
            for match in matches:
                kwargs = {key: getattr(match, key)}
                existing = Match.objects.filter(classified_failure=other, **kwargs)
                if existing:
                    for existing_match in existing:
                        if match.score > existing_match.score:
                            existing_match.score = match.score
                            existing_match.save()
                    delete_ids.append(match.id)
                else:
                    match.classified_failure = other
                    match.save()
            Match.objects.filter(id__in=delete_ids).delete()
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


class MatcherManager(models.Manager):
    _matcher_funcs = LazyClassData(OrderedDict, _init_matchers)

    @classmethod
    def register_matcher(cls, matcher_cls):
        if cls._matcher_funcs is None:
            raise AssertionError

        return cls._register(matcher_cls, cls._matcher_funcs)

    @staticmethod
    def _register(cls_to_register, dest):
        # if this has already been registered, then just return the previously
        # created instance.
        if cls_to_register.__name__ in dest:
            return dest[cls_to_register.__name__]

        instance = cls_to_register()
        dest[cls_to_register.__name__] = instance

        return instance

    def registered_matchers(self):
        for matcher in self._matcher_funcs.values():
            yield matcher

    def get(self, name):
        try:
            return models.Manager.get(self, name=name)
        except Matcher.DoesNotExist:
            self._matcher_funcs
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

    matcher_name = models.CharField(max_length=255)
    score = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)

    # TODO: add indexes once we know which queries will be typically executed

    class Meta:
        db_table = 'failure_match'
        verbose_name_plural = 'failure matches'
        unique_together = (
            ('failure_line', 'classified_failure', 'matcher_name')
        )

    def __str__(self):
        return "{0} {1}".format(
            self.failure_line.id, self.classified_failure.id)


@python_2_unicode_compatible
class RunnableJob(models.Model):
    id = models.AutoField(primary_key=True)
    build_platform = models.ForeignKey(BuildPlatform, on_delete=models.CASCADE)
    machine_platform = models.ForeignKey(MachinePlatform, on_delete=models.CASCADE)
    job_type = models.ForeignKey(JobType, on_delete=models.CASCADE)
    job_group = models.ForeignKey(JobGroup, on_delete=models.CASCADE, default=2)
    option_collection_hash = models.CharField(max_length=64)
    ref_data_name = models.CharField(max_length=255)
    build_system_type = models.CharField(max_length=25)
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
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

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="text_log_step")

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
    SUPERSEDED = 8

    RESULTS = ((SUCCESS, 'success'),
               (TEST_FAILED, 'testfailed'),
               (BUSTED, 'busted'),
               (SKIPPED, 'skipped'),
               (EXCEPTION, 'exception'),
               (RETRY, 'retry'),
               (USERCANCEL, 'usercancel'),
               (UNKNOWN, 'unknown'),
               (SUPERSEDED, 'superseded'))

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


class TextLogError(models.Model):
    """
    A detected error line in the textual (unstructured) log
    """
    id = models.BigAutoField(primary_key=True)

    step = models.ForeignKey(TextLogStep, on_delete=models.CASCADE, related_name='errors')
    line = models.TextField()
    line_number = models.PositiveIntegerField()

    class Meta:
        db_table = "text_log_error"
        unique_together = ('step', 'line_number')

    def __str__(self):
        return "{0} {1}".format(self.id, self.step.job.id)

    @property
    def metadata(self):
        try:
            return self._metadata
        except TextLogErrorMetadata.DoesNotExist:
            return None

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

    def set_classification(self, matcher_name, classification=None, bug_number=None,
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
                matcher_name=matcher_name,
                score=1)
            new_link.save()

            if self.metadata and self.metadata.failure_line:
                new_link_failure = FailureMatch(
                    failure_line=self.metadata.failure_line,
                    classified_failure=classification,
                    matcher_name=matcher_name,
                    score=1)
                new_link_failure.save()

            if mark_best:
                self.mark_best_classification(classification)

        return classification, new_link

    def mark_best_classification(self, classification_id):
        """
        Set the given FailureClassification as the best one

        Given an instance of FailureClassification links this TextLogError and
        a possible FailureLine to it, denoting it's the best possible match.

        If no TextLogErrorMetadata instance exists one will be created.
        """
        classification = ClassifiedFailure.objects.get(id=classification_id)

        if self.metadata is None:
            TextLogErrorMetadata.objects.create(
                text_log_error=self,
                best_classification=classification
            )
            return

        self.metadata.best_classification = classification
        self.metadata.save(update_fields=['best_classification'])

        if self.metadata.failure_line:
            self.metadata.failure_line.best_classification = classification
            self.metadata.failure_line.save(update_fields=['best_classification'])

            self.metadata.failure_line.elastic_search_insert()

    def mark_best_classification_verified(self, classification):
        if classification not in self.classified_failures.all():
            self.set_classification("ManualDetector", classification=classification)

        if self.metadata is None:
            TextLogErrorMetadata.objects.create(text_log_error=self,
                                                best_classification=classification,
                                                best_is_verified=True)
        else:
            self.metadata.best_classification = classification
            self.metadata.best_is_verified = True
            self.metadata.save()
        if self.metadata.failure_line:
            self.metadata.failure_line.best_classification = classification
            self.metadata.failure_line.best_is_verified = True
            self.metadata.failure_line.save()
            self.metadata.failure_line.elastic_search_insert()

    def update_autoclassification(self):
        """
        If a job is manually classified and has a single line in the logs matching a single
        TextLogError, but the TextLogError has not matched any ClassifiedFailure, add a
        new match due to the manual classification.
        """
        classification, _ = self.set_classification("ManualDetector")
        self.mark_best_classification_verified(classification)

    def get_failure_line(self):
        """Get a related FailureLine instance if one exists."""
        try:
            return self.metadata.failure_line
        except AttributeError:
            return None


@python_2_unicode_compatible
class TextLogErrorMetadata(models.Model):
    """Optional, mutable, data that can be associated with a TextLogError."""

    text_log_error = models.OneToOneField(TextLogError,
                                          primary_key=True,
                                          related_name="_metadata",
                                          on_delete=models.CASCADE)

    failure_line = models.OneToOneField(FailureLine,
                                        on_delete=models.CASCADE,
                                        related_name="text_log_error_metadata",
                                        null=True)

    # Note that the case of best_classification = None and best_is_verified = True
    # has the special semantic that the line is ignored and should not be considered
    # for future autoclassifications.
    best_classification = models.ForeignKey(ClassifiedFailure,
                                            related_name="best_for_errors",
                                            null=True,
                                            on_delete=models.SET_NULL)
    best_is_verified = models.BooleanField(default=False)

    class Meta:
        db_table = "text_log_error_metadata"

    def __str__(self):
        args = (self.text_log_error_id, self.failure_line_id)
        return 'TextLogError={} FailureLine={}'.format(*args)


class TextLogErrorMatch(models.Model):
    """Association table between TextLogError and ClassifiedFailure, containing
    additional data about the association including the matcher that was used
    to create it and a score in the range 0-1 for the goodness of match."""

    id = models.BigAutoField(primary_key=True)
    text_log_error = models.ForeignKey(TextLogError,
                                       related_name="matches",
                                       on_delete=models.CASCADE)
    classified_failure = models.ForeignKey(ClassifiedFailure,
                                           related_name="error_matches",
                                           on_delete=models.CASCADE)

    matcher_name = models.CharField(max_length=255)
    score = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)

    class Meta:
        db_table = 'text_log_error_match'
        verbose_name_plural = 'text log error matches'
        unique_together = (
            ('text_log_error', 'classified_failure', 'matcher_name')
        )

    def __str__(self):
        return "{0} {1}".format(
            self.text_log_error.id, self.classified_failure.id)

    @classmethod
    def create(cls, classified_failure_id, matcher_name, score, text_log_error):
        """Create a TextLogErrorMatch and matching FailureMatch."""
        TextLogErrorMatch.objects.create(
            score=score,
            matcher_name=matcher_name,
            classified_failure_id=classified_failure_id,
            text_log_error=text_log_error,
        )

        failure_line = text_log_error.get_failure_line()
        if not failure_line:
            return

        FailureMatch.objects.create(
            score=score,
            matcher_name=matcher_name,
            classified_failure_id=classified_failure_id,
            failure_line=failure_line,
        )
