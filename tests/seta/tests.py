import datetime

from django.utils import timezone

from .models import (JobPriority,
                     TaskRequest)

TOMORROW = timezone.now() + datetime.timedelta(days=1)
YESTERDAY = timezone.now() + datetime.timedelta(days=1)


# TaskRequests test
def test_create_instance():
    TaskRequest.objects.create(repo_name='mozilla-central',
                               counter=0,
                               last_request=timezone.now(),
                               reset_delta=0)


# JobPriority tests
def test_expired_job_priority():
    jb = JobPriority.objects.create(testtype='web-platform-tests-1',
                                    buildtype='opt',
                                    platform='windows8-64',
                                    priority=1,
                                    timeout=5400,
                                    expiration_date=YESTERDAY,
                                    buildsystem='taskcluster')
    assert jb.has_expired() is True


def test_not_expired_job_priority():
    jb = JobPriority.objects.create(testtype='web-platform-tests-1',
                                    buildtype='opt',
                                    platform='windows8-64',
                                    priority=1,
                                    timeout=5400,
                                    expiration_date=TOMORROW,
                                    buildsystem='taskcluster')
    assert jb.has_expired() is False


def test_null_testtype():
    '''The expiration date accepts null values'''
    # XXX: This should probably raise an exception
    JobPriority.objects.create(testtype=None,
                               buildtype='opt',
                               platform='windows8-64',
                               priority=1,
                               timeout=5400,
                               expiration_date=TOMORROW,
                               buildsystem='taskcluster')


def test_null_expiration_date():
    '''The expiration date accepts null values'''
    JobPriority.objects.create(testtype='web-platform-tests-2',
                               buildtype='opt',
                               platform='windows8-64',
                               priority=1,
                               timeout=5400,
                               expiration_date=None,
                               buildsystem='taskcluster')


def test_prevent_duplicates():
    '''The expiration date accepts null values'''
    JobPriority.objects.create(testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
                               priority=1, timeout=5400, expiration_date=TOMORROW, buildsystem='taskcluster')
    # XXX: Should this not raise an exception?
    JobPriority.objects.create(testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
                               priority=1, timeout=5400, expiration_date=TOMORROW, buildsystem='taskcluster')
