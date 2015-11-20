import pytest
from webtest.app import AppError

from treeherder.client import TreeherderClient


def test_update_parse_status_nonexistent_id(test_project, mock_post_json):
    """
    Attempting to update the parse status for a non-existent log should return a 404.
    """
    client = TreeherderClient(protocol='http', host='localhost')
    non_existent_id = 9999999
    with pytest.raises(AppError) as e:
        client.update_parse_status(test_project, non_existent_id, 'parsed')
    assert "404 NOT FOUND" in str(e.value)
