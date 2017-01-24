import logging

from django.db import models
from django.utils import timezone
from django.utils.encoding import python_2_unicode_compatible

from treeherder.config.settings import SETA_LOW_VALUE_PRIORITY
from treeherder.model.models import Repository
from treeherder.seta.common import unique_key

logger = logging.getLogger(__name__)


class JobPriorityManager(models.Manager):
    def clear_expiration_field_for_expired_jobs(self):
        '''Set the expiration date of every job that has expired.'''
        # Only select rows where there is an expiration date set
        for job in JobPriority.objects.filter(expiration_date__isnull=False):
            if job.has_expired():
                job.expiration_date = None
                job.save()

    def adjust_jobs_priority(self, high_value_jobs, priority=1, timeout=0):
        """For every job priority determine if we need to increase or decrease the job priority

        Currently, high value jobs have a priority of 1 and a timeout of 0.
        """
        # Only job priorities that don't have an expiration date (2 weeks for new jobs or year 2100
        # for jobs update via load_preseed) are updated
        for jp in JobPriority.objects.filter(expiration_date__isnull=True):
            if jp.unique_identifier() not in high_value_jobs:
                if jp.priority != SETA_LOW_VALUE_PRIORITY:
                    logger.info('Decreasing priority of {}'.format(jp.unique_identifier()))
                    jp.priority = SETA_LOW_VALUE_PRIORITY
                    jp.save(update_fields=['priority'])
            elif jp.priority != priority:
                logger.info('Increasing priority of {}'.format(jp.unique_identifier()))
                jp.priority = priority
                jp.save(update_fields=['priority', 'timeout'])


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
    expiration_date = models.DateTimeField(null=True)

    # Q: Do we need indexing?
    unique_together = ('testtype', 'buildtype', 'platform')

    def has_expired(self):
        now = timezone.now()
        if self.expiration_date:
            return self.expiration_date < now
        else:
            return True

    def unique_identifier(self):
        return unique_key(testtype=self.testtype,
                          buildtype=self.buildtype,
                          platform=self.platform)

    def __str__(self):
        return ','.join((self.buildsystem, self.platform, self.buildtype, self.testtype))
