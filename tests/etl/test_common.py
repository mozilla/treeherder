
from django.conf import settings


def test_get_revision_hash(jm, initial_data,
                           result_set_stored, mock_get_resultset):
    """That the correct revision_hash is retrieved is the revision exists"""
    from treeherder.etl import common
    project = settings.DATABASES["default"]["TEST_NAME"]
    revision = result_set_stored['revisions'][0]['revision']
    resultset = common.get_resultset(project, revision)

    assert resultset['revision_hash'] == result_set_stored['revision_hash']


def test_get_revision_hash_none(jm, mock_get_remote_content,
                                initial_data, result_set_stored):
    """Test that none is returned if the revision doesn't exist"""
    from treeherder.etl import common
    project = settings.DATABASES["default"]["TEST_NAME"]
    revision = "fakerevision"
    resultset = common.get_resultset(project, revision)

    assert resultset == None