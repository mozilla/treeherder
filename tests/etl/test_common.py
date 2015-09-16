from treeherder.etl import common


def test_get_revision_hash(initial_data,
                           result_set_stored, mock_get_remote_content):
    """That the correct revision_hash is retrieved if the revision exists"""
    project = result_set_stored[0]['revisions'][0]['repository']
    revision = result_set_stored[0]['revisions'][0]['revision']
    resultset = common.lookup_revisions({project: [revision]})
    assert resultset[project][revision]['revision_hash'] == result_set_stored[0]['revision_hash']


def test_get_revision_hash_none(mock_get_remote_content, test_project,
                                initial_data, result_set_stored):
    """Test that none is returned if the revision doesn't exist"""
    project = test_project
    revision = "fakerevision"
    resultset = common.lookup_revisions({project: [revision]})
    assert len(resultset) == 0
