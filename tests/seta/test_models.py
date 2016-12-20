import datetime

import pytest
from django.db.utils import IntegrityError
from django.utils import timezone

from treeherder.seta.models import (JobPriority,
                                    TaskRequest)

TOMORROW = timezone.now() + datetime.timedelta(days=1)
YESTERDAY = timezone.now() - datetime.timedelta(days=1)


# TaskRequest tests
def test_create_instance(test_repository):
    TaskRequest.objects.create(repository=test_repository,
                               counter=0,
                               last_reset=timezone.now(),
                               reset_delta=0)


# JobPriority tests
def test_expired_job_priority():
    jp = JobPriority(testtype='web-platform-tests-1',
                     buildtype='opt',
                     platform='windows8-64',
                     priority=1,
                     timeout=5400,
                     expiration_date=YESTERDAY,
                     buildsystem='taskcluster')
    assert jp.has_expired() is True


def test_not_expired_job_priority():
    jp = JobPriority(testtype='web-platform-tests-1',
                     buildtype='opt',
                     platform='windows8-64',
                     priority=1,
                     timeout=5400,
                     expiration_date=TOMORROW,
                     buildsystem='taskcluster')
    assert jp.has_expired() is False


@pytest.mark.django_db()
def test_null_testtype():
    '''The expiration date accepts null values'''
    with pytest.raises(IntegrityError):
        JobPriority.objects.create(
            testtype=None,
            buildtype='opt',
            platform='windows8-64',
            priority=1,
            timeout=5400,
            expiration_date=TOMORROW,
            buildsystem='taskcluster')


@pytest.mark.django_db()
def test_null_expiration_date():
    '''The expiration date accepts null values'''
    jp = JobPriority.objects.create(
        testtype='web-platform-tests-2',
        buildtype='opt',
        platform='windows8-64',
        priority=1,
        timeout=5400,
        expiration_date=None,
        buildsystem='taskcluster')
    assert jp.expiration_date is None
