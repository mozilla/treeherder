import datetime

from django.utils import timezone

from .models import (JobPriority,
                     TaskRequest)


class TaskRequestTests():
    def test_create_instance(self):
        tr = TaskRequest(repo_name='mozilla-central', counter=0,
                         last_request=timezone.now(), reset_delta=0)
        tr.save()


class JobPriorityTests():
    def test_create_instance(self):
        jb = JobPriority(
            testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
            priority=1, timeout=5400, expiration_date=timezone.now(), buildsystem='taskcluster')
        jb.save()

    def test_expired_job_priority(self):
        yesterday = timezone.now() - datetime.timedelta(days=1)
        jb = JobPriority(
            testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
            priority=1, timeout=5400, expiration_date=yesterday, buildsystem='taskcluster')
        jb.save()
        assert jb.has_expired() is True

    def test_not_expired_job_priority(self):
        tomorrow = timezone.now() + datetime.timedelta(days=1)
        jb = JobPriority(
            testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
            priority=1, timeout=5400, expiration_date=tomorrow, buildsystem='taskcluster')
        jb.save()
        assert jb.has_expired() is False

    def test_null_testtype(self):
        '''The expiration date accepts null values'''
        tomorrow = timezone.now() + datetime.timedelta(days=1)
        jb = JobPriority(
            testtype=None, buildtype='opt', platform='windows8-64',
            priority=1, timeout=5400, expiration_date=tomorrow, buildsystem='taskcluster')
        jb.save()

    def test_null_expiration_date(self):
        '''The expiration date accepts null values'''
        jb = JobPriority(
            testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
            priority=1, timeout=5400, expiration_date=None, buildsystem='taskcluster')
        jb.save()

    def test_prevent_duplicates(self):
        '''The expiration date accepts null values'''
        tomorrow = timezone.now() + datetime.timedelta(days=1)
        jb = JobPriority(
            testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
            priority=1, timeout=5400, expiration_date=tomorrow, buildsystem='taskcluster')
        jb.save()
        jb = JobPriority(
            testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
            priority=1, timeout=5400, expiration_date=tomorrow, buildsystem='taskcluster')
        jb.save()
