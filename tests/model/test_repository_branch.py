import pytest
from django.core.exceptions import ValidationError

from treeherder.model.models import RepositoryBranch


@pytest.mark.django_db
@pytest.mark.parametrize(
    "branch",
    [
        "*",
        "master",
        "releases/*",
        "foo/bar/*",
    ],
)
def test_repository_branch_valid_patterns(branch, test_repository):
    rb = RepositoryBranch(repository=test_repository, branch=branch)
    rb.clean()  # should not raise


@pytest.mark.django_db
@pytest.mark.parametrize(
    "branch",
    [
        "foo*bar",
        "*release",
        "re*ases",
        "a*b*",
    ],
)
def test_repository_branch_invalid_patterns(branch, test_repository):
    rb = RepositoryBranch(repository=test_repository, branch=branch)
    with pytest.raises(ValidationError):
        rb.clean()
