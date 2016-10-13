import datetime

from django.utils import timezone
from django.test import TestCase

from .models import TaskRequest, JobPriority


class TaskRequestTests(TestCase):
    def test_create_instance(self):
        TaskRequest(repo_name='mozilla-central', counter=0, last_request=timezone.now(),
                     reset_delta=0)


class JobPriorityTests(TestCase):
    def test_create_instance(self):
        JobPriority(testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
                    priority=1, timeout=5400, expires=timezone.now(), buildsystem='taskcluster')

    def test_expired_job_priority(self):
        yesterday = timezone.now() - datetime.timedelta(days=1)
        jb = JobPriority(testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
                         priority=1, timeout=5400, expires=yesterday, buildsystem='taskcluster')
        self.assertIs(jb.has_expired(), True)

    def test_not_expired_job_priority(self):
        tomorrow = timezone.now() + datetime.timedelta(days=1)
        jb = JobPriority(testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
                         priority=1, timeout=5400, expires=tomorrow, buildsystem='taskcluster')
        self.assertIs(jb.has_expired(), False)
