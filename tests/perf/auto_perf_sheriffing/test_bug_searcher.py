from datetime import datetime, timezone
from unittest.mock import patch

import pytest
import requests
import responses

from treeherder.perf.auto_perf_sheriffing.bug_searcher import BugSearcher


@pytest.fixture
def bug_searcher(mock_bugfiler_settings):
    """Fixture providing a BugSearcher instance."""
    return BugSearcher()


class TestBugSearcherInitialization:
    """Tests for BugSearcher initialization."""

    def test_bug_searcher_initialization(self, bug_searcher):
        """Test BugSearcher initializes with correct defaults."""
        assert bug_searcher.bz_url == "https://bugzilla.mozilla.org/rest/bug?"
        assert bug_searcher.bz_headers == {}
        assert bug_searcher._include_fields == ["id"]
        assert bug_searcher._products == []
        assert bug_searcher._query == {}


class TestBugSearcherSetters:
    """Tests for BugSearcher setter methods."""

    def test_set_include_fields(self, bug_searcher):
        """Test set_include_fields updates include_fields correctly."""
        fields = ["id", "summary", "status", "resolution"]
        bug_searcher.set_include_fields(fields)
        assert bug_searcher._include_fields == fields

    def test_set_include_fields_with_history(self, bug_searcher):
        """Test set_include_fields can include history field."""
        fields = ["id", "history", "status"]
        bug_searcher.set_include_fields(fields)
        assert bug_searcher._include_fields == fields
        assert "history" in bug_searcher._include_fields

    def test_set_products_single(self, bug_searcher):
        """Test set_products with single product."""
        products = ["Firefox"]
        bug_searcher.set_products(products)
        assert bug_searcher._products == products

    def test_set_products_multiple(self, bug_searcher):
        """Test set_products with multiple products."""
        products = ["Firefox", "Core", "Toolkit"]
        bug_searcher.set_products(products)
        assert bug_searcher._products == products

    def test_set_products_empty(self, bug_searcher):
        """Test set_products with empty list."""
        bug_searcher.set_products([])
        assert bug_searcher._products == []

    def test_set_query(self, bug_searcher):
        """Test set_query updates query correctly."""
        query = {
            "f1": "status",
            "o1": "equals",
            "v1": "NEW",
            "chfieldfrom": "2024-01-01",
        }
        bug_searcher.set_query(query)
        assert bug_searcher._query == query

    def test_set_query_with_time_range(self, bug_searcher):
        """Test set_query with time range parameters."""
        query = {
            "chfieldfrom": "2024-01-01",
            "chfieldto": "2024-12-31",
        }
        bug_searcher.set_query(query)
        assert bug_searcher._query["chfieldfrom"] == "2024-01-01"
        assert bug_searcher._query["chfieldto"] == "2024-12-31"


class TestBugSearcherHelperMethods:
    """Tests for BugSearcher helper methods."""

    @patch("treeherder.perf.auto_perf_sheriffing.bug_searcher.datetime")
    def test_get_today_date(self, mock_datetime, bug_searcher):
        """Test get_today_date returns correct format."""
        mock_now = datetime(2024, 3, 15, 10, 30, 0, tzinfo=timezone.utc)
        mock_datetime.now.return_value = mock_now

        result = bug_searcher.get_today_date()

        assert result == mock_now.date()
        mock_datetime.now.assert_called_once_with(timezone.utc)

    def test_find_last_query_num_no_queries(self, bug_searcher):
        """Test _find_last_query_num returns 0 when no query fields exist."""
        bug_searcher.set_query({"status": "NEW"})
        result = bug_searcher._find_last_query_num()
        assert result == 0

    def test_find_last_query_num_single_query(self, bug_searcher):
        """Test _find_last_query_num with single query field."""
        bug_searcher.set_query({"f1": "status", "o1": "equals", "v1": "NEW"})
        result = bug_searcher._find_last_query_num()
        assert result == 1

    def test_find_last_query_num_multiple_queries(self, bug_searcher):
        """Test _find_last_query_num with multiple query fields."""
        bug_searcher.set_query(
            {
                "f1": "status",
                "o1": "equals",
                "v1": "NEW",
                "f2": "priority",
                "o2": "equals",
                "v2": "P1",
                "f5": "product",
                "o5": "equals",
                "v5": "Firefox",
            }
        )
        result = bug_searcher._find_last_query_num()
        assert result == 5


class TestBuildBugzillaParams:
    """Tests for _build_bugzilla_params method."""

    def test_build_params_basic_query(self, bug_searcher):
        """Test _build_bugzilla_params with basic query."""
        query = {"status": "NEW"}
        bug_searcher.set_query(query)

        params = bug_searcher._build_bugzilla_params()

        assert params["status"] == "NEW"
        assert params["include_fields"] == ["id"]

    def test_build_params_with_custom_include_fields(self, bug_searcher):
        """Test _build_bugzilla_params respects custom include_fields."""
        query = {"status": "NEW"}
        fields = ["id", "summary", "status"]

        bug_searcher.set_query(query)
        bug_searcher.set_include_fields(fields)

        params = bug_searcher._build_bugzilla_params()

        assert params["include_fields"] == fields

    def test_build_params_query_with_include_fields(self, bug_searcher):
        """Test _build_bugzilla_params when query already has include_fields."""
        query = {"status": "NEW", "include_fields": ["id", "history"]}
        bug_searcher.set_query(query)

        params = bug_searcher._build_bugzilla_params()

        # Should keep the query's include_fields
        assert params["include_fields"] == ["id", "history"]

    def test_build_params_with_products_no_existing_query(self, bug_searcher):
        """Test _build_bugzilla_params adds product filter correctly."""
        query = {"status": "NEW"}
        products = ["Firefox", "Core"]

        bug_searcher.set_query(query)
        bug_searcher.set_products(products)

        params = bug_searcher._build_bugzilla_params()

        assert params["f0"] == "product"
        assert params["o0"] == "anywordssubstr"
        assert params["v0"] == "Firefox,Core"

    def test_build_params_with_products_and_existing_queries(self, bug_searcher):
        """Test _build_bugzilla_params adds product filter after existing queries."""
        query = {
            "f1": "status",
            "o1": "equals",
            "v1": "NEW",
            "f2": "priority",
            "o2": "equals",
            "v2": "P1",
        }
        products = ["Firefox"]

        bug_searcher.set_query(query)
        bug_searcher.set_products(products)

        params = bug_searcher._build_bugzilla_params()

        # Should add product after query 2
        assert params["f2"] == "product"
        assert params["o2"] == "anywordssubstr"
        assert params["v2"] == "Firefox"

    def test_build_params_without_products(self, bug_searcher):
        """Test _build_bugzilla_params without products filter."""
        query = {"status": "NEW"}
        bug_searcher.set_query(query)

        params = bug_searcher._build_bugzilla_params()

        assert "f0" not in params
        assert "o0" not in params
        assert "v0" not in params

    def test_build_params_preserves_original_query(self, bug_searcher):
        """Test _build_bugzilla_params doesn't modify original query."""
        original_query = {"status": "NEW"}
        bug_searcher.set_query(original_query)
        bug_searcher.set_products(["Firefox"])

        params = bug_searcher._build_bugzilla_params()

        # Original query should not be modified
        assert "f0" not in bug_searcher._query
        assert "f0" in params


class TestGetBugs:
    """Tests for get_bugs method."""

    @responses.activate
    def test_get_bugs_success(self, bug_searcher):
        """Test get_bugs successfully retrieves bugs."""
        expected_response = {
            "bugs": [
                {"id": 123456},
                {"id": 789012},
            ]
        }

        responses.add(
            responses.GET,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        query = {"status": "NEW"}
        bug_searcher.set_query(query)

        result = bug_searcher.get_bugs()

        assert result == expected_response
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_bugs_with_include_fields(self, bug_searcher):
        """Test get_bugs sends correct include_fields parameter."""
        expected_response = {"bugs": [{"id": 123456, "summary": "Test Bug", "status": "NEW"}]}

        responses.add(
            responses.GET,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        query = {"status": "NEW"}
        fields = ["id", "summary", "status"]

        bug_searcher.set_query(query)
        bug_searcher.set_include_fields(fields)

        result = bug_searcher.get_bugs()

        assert result == expected_response
        # Check that the request included the correct parameters
        request_params = responses.calls[0].request.url
        assert "include_fields" in request_params

    @responses.activate
    def test_get_bugs_with_products(self, bug_searcher):
        """Test get_bugs includes product filter in request."""
        expected_response = {"bugs": [{"id": 123456}]}

        responses.add(
            responses.GET,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        query = {"status": "NEW"}
        products = ["Firefox", "Core"]

        bug_searcher.set_query(query)
        bug_searcher.set_products(products)

        result = bug_searcher.get_bugs()

        assert result == expected_response
        request_url = responses.calls[0].request.url
        # Verify product parameters are in the URL
        assert "f0=product" in request_url
        assert "o0=anywordssubstr" in request_url

    @responses.activate
    def test_get_bugs_sends_user_agent_header(self, bug_searcher):
        """Test get_bugs sends correct User-Agent header."""
        expected_response = {"bugs": []}

        responses.add(
            responses.GET,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        query = {"status": "NEW"}
        bug_searcher.set_query(query)

        bug_searcher.get_bugs()

        request_headers = responses.calls[0].request.headers
        assert request_headers["User-Agent"] == "treeherder/treeherder.mozilla.org"

    @responses.activate
    def test_get_bugs_http_error(self, bug_searcher):
        """Test get_bugs raises HTTPError on failure."""
        responses.add(
            responses.GET,
            "https://bugzilla.mozilla.org/rest/bug",
            json={"error": True, "message": "Invalid request"},
            status=400,
        )

        query = {"status": "NEW"}
        bug_searcher.set_query(query)

        with pytest.raises(requests.exceptions.HTTPError):
            bug_searcher.get_bugs()

    def test_get_bugs_without_query_returns_none(self, bug_searcher, caplog):
        """Test get_bugs returns None when no query is set."""
        # Don't set a query
        result = bug_searcher.get_bugs()

        assert result is None

    @responses.activate
    def test_get_bugs_empty_result(self, bug_searcher):
        """Test get_bugs handles empty bug list correctly."""
        expected_response = {"bugs": []}

        responses.add(
            responses.GET,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        query = {"status": "NEW"}
        bug_searcher.set_query(query)

        result = bug_searcher.get_bugs()

        assert result == expected_response
        assert result["bugs"] == []

    @responses.activate
    def test_get_bugs_complex_query(self, bug_searcher):
        """Test get_bugs with complex query parameters."""
        expected_response = {"bugs": [{"id": 123456}]}

        responses.add(
            responses.GET,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        query = {
            "f1": "status",
            "o1": "equals",
            "v1": "NEW",
            "f2": "priority",
            "o2": "anyexact",
            "v2": "P1,P2",
            "chfieldfrom": "2024-01-01",
            "chfieldto": "2024-12-31",
        }

        bug_searcher.set_query(query)
        bug_searcher.set_include_fields(["id", "summary", "history"])
        bug_searcher.set_products(["Firefox", "Core"])

        result = bug_searcher.get_bugs()

        assert result == expected_response
        request_url = responses.calls[0].request.url

        # Verify all parameters are present
        assert "f1=status" in request_url
        assert "v1=NEW" in request_url
        assert "chfieldfrom=2024-01-01" in request_url

    @responses.activate
    def test_get_bugs_network_timeout(self, bug_searcher):
        """Test get_bugs handles network timeout."""
        responses.add(
            responses.GET,
            "https://bugzilla.mozilla.org/rest/bug",
            body=requests.exceptions.Timeout("Connection timeout"),
        )

        query = {"status": "NEW"}
        bug_searcher.set_query(query)

        with pytest.raises(requests.exceptions.Timeout):
            bug_searcher.get_bugs()
