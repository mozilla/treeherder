from treeherder.etl import common


def test_get_revision_hash(initial_data,
                           result_set_stored, mock_fetch_json):
    """That the correct revision_hash is retrieved if the revision exists"""
    project = result_set_stored[0]['revisions'][0]['repository']
    # todo: Continue using short revisions until Bug 1199364
    short_revision = result_set_stored[0]['revisions'][0]['revision'][:12]
    resultset = common.lookup_revisions({project: [short_revision]})
    assert resultset[project][short_revision]['revision_hash'] == result_set_stored[0]['revision_hash']


def test_get_revision_hash_none(mock_fetch_json, test_project,
                                initial_data, result_set_stored):
    """Test that none is returned if the revision doesn't exist"""
    project = test_project
    revision = "fakerevision"
    resultset = common.lookup_revisions({project: [revision]})
    assert len(resultset) == 0
