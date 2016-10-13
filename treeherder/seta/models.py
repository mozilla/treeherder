from treeherder.model.models import Repository

from django.db import models
from django.utils import timezone


class TaskRequest(models.Model):
    ''' Track TaskCluster requests for SETA information.

    The Gecko decision task executes on every push and it queries SETA for information.
    This information is used the graph generation code to determine which jobs
    to exclude on that run or not.
    '''
    repository = models.ForeignKey(Repository)
    counter = models.IntegerField()  # Number of times TC has reached the API
    last_request = models.DateTimeField()  # Last time TC reached the API
    reset_delta = models.IntegerField()  # Maximum number of pushes before SETA is skipped

    def __str__(self):
        return '%s/%s/%s'.format(
            self.repository.name,
            self.counter,
            self.reset_delta
        )


class JobPriority(models.Model):
    # This field is sanitized to unify name from Buildbot and TaskCluster
    testtype = models.CharField(max_length=128)  # e.g. web-platform-tests-1
    buildtype = models.CharField(max_length=64)  # e.g. {opt,pgo,debug}
    platform = models.CharField(max_length=64)  # e.g. windows8-64
    priority = models.IntegerField()  # 1 or 5
    timeout = models.IntegerField()  # e.g. 5400
    expires = models.DateTimeField()
    buildsystem = models.CharField(max_length=64)

    def has_expired(self):
        now = timezone.now()
        return self.expires < now

    def __str__(self):
        return '%s/%s/%s'.format(
            self.testtype,
            self.buildype,
            self.priority
        )
