import datetime

import pytest
from django.db.utils import IntegrityError
from django.utils import timezone

from treeherder.seta.models import JobPriority

TOMORROW = timezone.now() + datetime.timedelta(days=1)
YESTERDAY = timezone.now() - datetime.timedelta(days=1)


# JobPriority tests
def test_expired_job_priority():
    jp = JobPriority(testtype='web-platform-tests-1',
                     buildtype='opt',
                     platform='windows8-64',
                     priority=1,
                     expiration_date=YESTERDAY,
                     buildsystem='taskcluster')
    assert jp.has_expired()


def test_not_expired_job_priority():
    jp = JobPriority(testtype='web-platform-tests-1',
                     buildtype='opt',
                     platform='windows8-64',
                     priority=1,
                     expiration_date=TOMORROW,
                     buildsystem='taskcluster')
    assert not jp.has_expired()


@pytest.mark.django_db()
def test_null_testtype():
    '''The expiration date accepts null values'''
    with pytest.raises(IntegrityError):
        JobPriority.objects.create(
            testtype=None,
            buildtype='opt',
            platform='windows8-64',
            priority=1,
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
        expiration_date=None,
        buildsystem='taskcluster')
    assert jp.expiration_date is None
