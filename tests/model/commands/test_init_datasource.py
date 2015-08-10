import pytest
from django.core.management import call_command

from treeherder.model.models import Datasource, Repository, RepositoryGroup


@pytest.fixture
def repository_group():
    return RepositoryGroup.objects.create(name="mygroup")


@pytest.fixture
def repository(repository_group):
    return Repository.objects.create(
        repository_group=repository_group,
        name="my_test_repo",
        dvcs_type="hg",
        url="my_repo_url"
    )


def test_init_datasources(repository):
    """check that a new datasource is created if a repo is available"""
    count_before = Datasource.objects.all().count()
    call_command("init_datasources")
    count_after = Datasource.objects.all().count()
    assert count_after == count_before + 1


def test_init_datasources_no_repo():
    """check that no datasources are created if there are no repo"""
    count_before = Datasource.objects.all().count()
    call_command("init_datasources")
    count_after = Datasource.objects.all().count()
    assert count_after == count_before
