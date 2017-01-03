from django.db import models
from django.utils import timezone
from django.utils.encoding import python_2_unicode_compatible

from treeherder.model.models import Repository
from treeherder.seta.common import unique_key


@python_2_unicode_compatible
class TaskRequest(models.Model):
    ''' Track TaskCluster requests for SETA information.

    The Gecko decision task executes on every push and it queries SETA for information.
    This information is used the graph generation code to determine which jobs
    to exclude on that run or not.
    '''
    repository = models.ForeignKey(Repository)
    counter = models.IntegerField()  # Number of times TC has reached the API
    last_reset = models.DateTimeField()  # Last time we expired
    reset_delta = models.IntegerField()  # Number of seconds

    def has_expired(self):
        now = timezone.now()
        return (now - self.last_reset).total_seconds() >= self.reset_delta

    def seconds_since_last_reset(self):
        now = timezone.now()
        return int((now - self.last_reset).total_seconds())

    def __str__(self):
        return ','.join((self.repository.name, self.counter, self.last_reset))


class JobPriorityManager(models.Manager):
    def clear_expiration_field_for_expired_jobs(self):
        '''Set the expiration date of every job that has expired.'''
        # Only select rows where there is an expiration date set
        for job in JobPriority.objects.filter(expiration_date__isnull=False):
            if job.has_expired():
                job.expiration_date = None
                job.save()

    def increase_jobs_priority(self, high_value_jobs, priority=1, timeout=0):
        """For every high value job see if we need to adjust the priority in the database

        Currently, high value jobs have a priority of 1 and a timeout of 0.
        """
        # Ignore job priorities without an expiration date set
        job_priorities_with_expirations = JobPriority.objects.filter(expiration_date__isnull=True)
        for item in high_value_jobs:
            # This is a query of a unique composite index, thus, a list of zero or one
            queryset = job_priorities_with_expirations.filter(testtype=item[0],
                                                              buildtype=item[1],
                                                              platform=item[2])
            assert len(queryset) == 1, \
                "Any job passed to this function should already be in the database ({})".format(item)

            job = queryset[0]
            if job.priority != priority:
                job.priority = priority
                job.timeout = timeout
                job.save()


@python_2_unicode_compatible
class JobPriority(models.Model):
    # Use custom manager
    objects = JobPriorityManager()

    # This field is sanitized to unify name from Buildbot and TaskCluster
    testtype = models.CharField(max_length=128)  # e.g. web-platform-tests-1
    buildsystem = models.CharField(max_length=64)
    buildtype = models.CharField(max_length=64)  # e.g. {opt,pgo,debug}
    platform = models.CharField(max_length=64)  # e.g. windows8-64
    priority = models.IntegerField()  # 1 or 5
    timeout = models.IntegerField()  # e.g. 5400
    expiration_date = models.DateTimeField(null=True)

    # Q: Do we need indexing?
    unique_together = ('testtype', 'buildtype', 'platform')

    def has_expired(self):
        now = timezone.now()
        return self.expiration_date < now

    def unique_identifier(self):
        return unique_key(testtype=self.testtype,
                          buildtype=self.buildtype,
                          platform=self.platform)

    def __str__(self):
        return ','.join((self.buildsystem, self.platform, self.buildtype, self.testtype))
