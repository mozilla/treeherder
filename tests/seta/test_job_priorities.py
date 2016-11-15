import datetime

from django.db.utils import IntegrityError
from django.utils import timezone
import pytest

from treeherder.seta.models import JobPriority

TOMORROW = timezone.now() + datetime.timedelta(days=1)
YESTERDAY = timezone.now() - datetime.timedelta(days=1)
slow = pytest.mark.slow


# JobPriority tests
def test_expired_job_priority():
    jb = JobPriority(testtype='web-platform-tests-1',
                     buildtype='opt',
                     platform='windows8-64',
                     priority=1,
                     timeout=5400,
                     expiration_date=YESTERDAY,
                     buildsystem='taskcluster')
    assert jb.has_expired() is True


def test_not_expired_job_priority():
    jb = JobPriority(testtype='web-platform-tests-1',
                     buildtype='opt',
                     platform='windows8-64',
                     priority=1,
                     timeout=5400,
                     expiration_date=TOMORROW,
                     buildsystem='taskcluster')
    assert jb.has_expired() is False


@slow
@pytest.mark.django_db(transaction=True)
def test_null_testtype():
    '''The expiration date accepts null values'''
    # XXX: It would be nice to be able to now have to wait for job insertion
    #      to realize that testtype is None. That way this test would not have to be slow
    with pytest.raises(IntegrityError):
        JobPriority.objects.create(
            testtype=None,
            buildtype='opt',
            platform='windows8-64',
            priority=1,
            timeout=5400,
            expiration_date=TOMORROW,
            buildsystem='taskcluster')


@slow
@pytest.mark.django_db(transaction=True)
def test_null_expiration_date():
    '''The expiration date accepts null values'''
    JobPriority.objects.create(
        testtype='web-platform-tests-2',
        buildtype='opt',
        platform='windows8-64',
        priority=1,
        timeout=5400,
        expiration_date=None,
        buildsystem='taskcluster')


@slow
@pytest.mark.skip("I expect the second creation to fail due to the unique composite index.")
@pytest.mark.django_db(transaction=True)
def test_prevent_duplicates():
    '''The expiration date accepts null values'''
    JobPriority.objects.create(
        testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
        priority=1, timeout=5400, expiration_date=TOMORROW, buildsystem='taskcluster')
    # XXX: Should this not raise an exception?
    JobPriority.objects.create(
        testtype='web-platform-tests-1', buildtype='opt', platform='windows8-64',
        priority=1, timeout=5400, expiration_date=TOMORROW, buildsystem='taskcluster')
