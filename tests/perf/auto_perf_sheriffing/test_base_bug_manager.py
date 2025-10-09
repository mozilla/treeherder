import pytest
import requests
import responses

from treeherder.perf.auto_perf_sheriffing.base_bug_manager import BugManager


@pytest.fixture
def bug_manager(mock_bugfiler_settings):
    """Fixture providing a BugManager instance."""
    return BugManager()


class TestBugManager:
    """Tests for the BugManager base class."""

    def test_bug_manager_initialization(self, bug_manager):
        """Test BugManager initialization sets correct URL and headers."""
        assert bug_manager.bz_url == "https://bugzilla.mozilla.org/rest/bug"
        assert bug_manager.bz_headers == {"Accept": "application/json"}

    def test_get_default_bug_creation_data(self, bug_manager):
        """Test that _get_default_bug_creation_data returns correct structure."""
        default_data = bug_manager._get_default_bug_creation_data()

        assert "summary" in default_data
        assert "type" in default_data
        assert "product" in default_data
        assert "component" in default_data
        assert "keywords" in default_data
        assert "whiteboard" in default_data
        assert "regressed_by" in default_data
        assert "see_also" in default_data
        assert "version" in default_data
        assert "severity" in default_data
        assert "priority" in default_data
        assert "description" in default_data

        assert default_data["summary"] == ""
        assert default_data["type"] == "defect"
        assert default_data["product"] == ""
        assert default_data["component"] == ""
        assert default_data["keywords"] == ""
        assert default_data["whiteboard"] is None
        assert default_data["regressed_by"] is None
        assert default_data["see_also"] is None
        assert default_data["version"] is None
        assert default_data["severity"] == ""
        assert default_data["priority"] == ""
        assert default_data["description"] == ""

    def test_get_default_bug_comment_data(self, bug_manager):
        """Test that _get_default_bug_comment_data returns correct structure."""
        default_data = bug_manager._get_default_bug_comment_data()

        assert "comment" in default_data
        assert "body" in default_data["comment"]
        assert default_data["comment"]["body"] == ""

    def test_add_needinfo_adds_flag_to_empty_bug_data(self, bug_manager):
        """Test _add_needinfo adds needinfo flag to bug data without flags."""
        bug_data = {}
        bug_manager._add_needinfo("user@example.com", bug_data)

        assert "flags" in bug_data
        assert len(bug_data["flags"]) == 1
        assert bug_data["flags"][0]["name"] == "needinfo"
        assert bug_data["flags"][0]["status"] == "?"
        assert bug_data["flags"][0]["requestee"] == "user@example.com"

    def test_add_needinfo_appends_to_existing_flags(self, bug_manager):
        """Test _add_needinfo appends to existing flags list."""
        bug_data = {"flags": [{"name": "other_flag", "status": "+"}]}
        bug_manager._add_needinfo("user@example.com", bug_data)

        assert len(bug_data["flags"]) == 2
        assert bug_data["flags"][0]["name"] == "other_flag"
        assert bug_data["flags"][1]["name"] == "needinfo"
        assert bug_data["flags"][1]["requestee"] == "user@example.com"

    @responses.activate
    def test_create_bug_success(self, bug_manager):
        """Test _create successfully creates a bug."""
        expected_response = {"id": 123456}
        responses.add(
            responses.POST,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        bug_data = {
            "summary": "Test Bug",
            "product": "Firefox",
            "component": "General",
            "description": "Test Description",
        }

        result = bug_manager._create(bug_data)

        assert result == expected_response
        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://bugzilla.mozilla.org/rest/bug"
        assert responses.calls[0].request.headers["x-bugzilla-api-key"] == "test-api-key"
        assert responses.calls[0].request.headers["Accept"] == "application/json"

    @responses.activate
    def test_create_bug_failure(self, bug_manager):
        """Test _create raises exception on failure."""
        responses.add(
            responses.POST,
            "https://bugzilla.mozilla.org/rest/bug",
            json={"error": True, "message": "Invalid data"},
            status=400,
        )

        bug_data = {"summary": "Invalid Bug"}

        with pytest.raises(requests.exceptions.HTTPError):
            bug_manager._create(bug_data)

    @responses.activate
    def test_create_bug_sends_correct_headers(self, bug_manager):
        """Test _create sends correct headers including API key."""
        responses.add(
            responses.POST,
            "https://bugzilla.mozilla.org/rest/bug",
            json={"id": 123456},
            status=200,
        )

        bug_data = {"summary": "Test"}
        bug_manager._create(bug_data)

        request = responses.calls[0].request
        assert request.headers["x-bugzilla-api-key"] == "test-api-key"
        assert request.headers["Accept"] == "application/json"

    @responses.activate
    def test_modify_bug_success(self, bug_manager):
        """Test _modify successfully modifies a bug."""
        expected_response = {"bugs": [{"id": 123456, "changes": {}}]}
        responses.add(
            responses.PUT,
            "https://bugzilla.mozilla.org/rest/bug/123456",
            json=expected_response,
            status=200,
        )

        changes = {"comment": {"body": "Additional comment"}}
        result = bug_manager._modify(123456, changes)

        assert result == expected_response
        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://bugzilla.mozilla.org/rest/bug/123456"
        assert responses.calls[0].request.headers["x-bugzilla-api-key"] == "test-commenter-key"
        assert (
            responses.calls[0].request.headers["User-Agent"] == "treeherder/treeherder.mozilla.org"
        )

    @responses.activate
    def test_modify_bug_failure(self, bug_manager):
        """Test _modify raises exception on failure."""
        responses.add(
            responses.PUT,
            "https://bugzilla.mozilla.org/rest/bug/123456",
            json={"error": True, "message": "Not authorized"},
            status=401,
        )

        changes = {"comment": {"body": "Comment"}}

        with pytest.raises(requests.exceptions.HTTPError):
            bug_manager._modify(123456, changes)

    @responses.activate
    def test_modify_bug_sends_correct_headers(self, bug_manager):
        """Test _modify sends correct headers including commenter API key."""
        responses.add(
            responses.PUT,
            "https://bugzilla.mozilla.org/rest/bug/999",
            json={"bugs": []},
            status=200,
        )

        changes = {"status": "RESOLVED"}
        bug_manager._modify(999, changes)

        request = responses.calls[0].request
        assert request.headers["x-bugzilla-api-key"] == "test-commenter-key"
        assert request.headers["User-Agent"] == "treeherder/treeherder.mozilla.org"
        assert request.headers["Accept"] == "application/json"

    def test_file_bug_not_implemented(self, bug_manager):
        """Test that file_bug raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            bug_manager.file_bug()

    def test_modify_bug_not_implemented(self, bug_manager):
        """Test that modify_bug raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            bug_manager.modify_bug()

    def test_comment_bug_not_implemented(self, bug_manager):
        """Test that comment_bug raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            bug_manager.comment_bug()
