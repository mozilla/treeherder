from django.conf import settings


def test_get_revision_hash(initial_data,
                           result_set_stored, mock_get_remote_content):
    """That the correct revision_hash is retrieved if the revision exists"""
    from treeherder.etl import common
    project = result_set_stored[0]['revisions'][0]['repository']
    # todo: Continue using short revisions until Bug 1199364
    short_revision = result_set_stored[0]['revisions'][0]['revision'][:12]
    resultset = common.lookup_revisions({project: [short_revision]})
    assert resultset[project][short_revision]['revision_hash'] == result_set_stored[0]['revision_hash']


def test_get_revision_hash_none(mock_get_remote_content,
                                initial_data, result_set_stored):
    """Test that none is returned if the revision doesn't exist"""
    from treeherder.etl import common
    project = settings.DATABASES["default"]["TEST_NAME"]
    revision = "fakerevision"
    resultset = common.lookup_revisions({project: [revision]})
    assert len(resultset) == 0
