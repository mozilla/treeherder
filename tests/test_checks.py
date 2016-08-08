import pytest
from mock import patch

from treeherder import checks


@pytest.mark.parametrize("version", ['5.7.11', '5.7.14'])
@patch("treeherder.checks.get_client_info")
def test_check_libmysqlclient_version_secure(mock_client_info, version):
    """Ensure the system check passes for libmysqlclient >= 5.7.11."""
    mock_client_info.return_value = version
    result = checks.check_libmysqlclient_version(None)
    assert result == []


@pytest.mark.parametrize("version", ['5.5.49', '5.7.10'])
@patch("treeherder.checks.get_client_info")
def test_check_libmysqlclient_version_insecure(mock_client_info, version):
    """Ensure the system check fails for libmysqlclient < 5.7.11."""
    mock_client_info.return_value = version
    result = checks.check_libmysqlclient_version(None)
    assert len(result) == 1
    assert result[0].id == "treeherder.E001"
    assert version in result[0].msg
