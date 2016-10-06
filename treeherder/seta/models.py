from django.db import models
from django.utils import timezone


class TaskRequests(models.Model):
    ''' Track TaskCluster requests for SETA information.

    The Gecko decision task executes on every push and it queries SETA for information.
    This information is used the graph generation code to determine which jobs
    to exclude on that run or not.
    '''
    repo_name = models.CharField(max_length=128, primary_key=True)  # e.g. mozilla-inbound
    counter = models.IntegerField()  # Number of times TC has reached the API
    last_request = models.DateTimeField()  # Last time TC reached the API
    reset_delta = models.IntegerField()  # Maximum number of pushes before SETA is skipped

    def __str__(self):
        return '%s/%s/%s'.format(
            self.repo_name,
            self.counter,
            self.reset_delta
        )


class JobPriorities(models.Model):
    # e.g. web-platform-tests-1; {opt,pgo,debug}; windows8-64; 5; 5400; {buildbot,taskcluster,*}
    testtype = models.CharField(max_length=128)
    buildtype = models.CharField(max_length=64)
    platform = models.CharField(max_length=64)
    priority = models.IntegerField()
    timeout = models.IntegerField()
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
