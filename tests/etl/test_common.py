from treeherder.etl import common


def test_get_revision(initial_data, test_project,
                      result_set_stored, mock_fetch_json):
    """That the correct revision is retrieved if the revision exists"""
    # todo: Continue using short revisions until Bug 1199364
    long_revision = result_set_stored[0]['revisions'][0]['revision']
    resultset = common.lookup_revisions({test_project: [long_revision]})
    assert resultset[test_project][long_revision]['revision'] == result_set_stored[0]['revision']


def test_get_revision_hash_none(mock_fetch_json, test_project,
                                initial_data, result_set_stored):
    """Test that none is returned if the revision doesn't exist"""
    project = test_project
    revision = "fakerevision"
    resultset = common.lookup_revisions({project: [revision]})
    assert len(resultset) == 0
