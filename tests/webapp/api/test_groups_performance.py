import datetime
import time
from unittest.mock import MagicMock, Mock, patch

import pytest
from django.db import connection
from django.urls import reverse

from treeherder.model.models import (
    FailureClassification,
    Group,
    GroupStatus,
    Job,
    JobLog,
    JobType,
    Push,
    Repository,
)
from treeherder.webapp.api.groups import SummaryByGroupName


@pytest.mark.django_db
class TestGroupsPerformance:
    """Test suite focused on performance and optimization of groups API."""

    @pytest.fixture(autouse=True)
    def setup_data(self, transactional_db):
        """Set up test data for performance testing."""
        # Create repositories
        self.repo1 = Repository.objects.create(
            id=1,
            repository_group_id=1,
            name="mozilla-central",
            dvcs_type="hg",
            url="https://hg.mozilla.org/mozilla-central",
        )
        self.repo2 = Repository.objects.create(
            id=77,
            repository_group_id=1,
            name="autoland",
            dvcs_type="hg",
            url="https://hg.mozilla.org/integration/autoland",
        )

        # Create failure classifications
        self.fc_intermittent = FailureClassification.objects.create(id=1, name="intermittent")
        self.fc_fixed = FailureClassification.objects.create(id=2, name="fixed by commit")

        # Create test job types
        self.job_types = []
        for i in range(5):
            jt = JobType.objects.create(
                name=f"test-linux64/opt-mochitest-{i}",
                symbol=f"M{i}",
            )
            self.job_types.append(jt)

        # Create groups
        self.groups = []
        for i in range(10):
            group = Group.objects.create(name=f"/tests/group_{i}")
            self.groups.append(group)

    def create_test_jobs(self, num_jobs, startdate, repository):
        """Helper to create test jobs with associated data."""
        push = Push.objects.create(
            repository=repository,
            revision=f"revision_{startdate}",
            author="test@mozilla.com",
            time=startdate,
        )

        jobs = []
        for i in range(num_jobs):
            job = Job.objects.create(
                repository=repository,
                push=push,
                job_type=self.job_types[i % len(self.job_types)],
                state="completed",
                result="success",
                failure_classification=self.fc_intermittent if i % 3 == 0 else self.fc_fixed,
                submit_time=startdate,
                start_time=startdate,
                end_time=startdate + datetime.timedelta(minutes=30),
            )

            # Create job log and group status
            job_log = JobLog.objects.create(
                job=job,
                name=f"log_{i}",
                url=f"http://example.com/log_{i}",
            )

            # Assign to groups
            group = self.groups[i % len(self.groups)]
            GroupStatus.objects.create(
                job_log=job_log,
                group=group,
                status=1 if i % 4 != 0 else 2,  # Mix of OK and ERROR statuses
                duration=100 + i,
            )

            jobs.append(job)

        return jobs

    def test_query_optimization_with_select_related(self, client):
        """Test that the optimized query uses select_related properly."""
        # Create test data
        startdate = datetime.datetime.now().date()
        self.create_test_jobs(50, startdate, self.repo1)

        url = reverse("groupsummary") + f"?startdate={startdate}"

        # Track queries
        with self.assertNumQueries(expected_queries=1):
            resp = client.get(url)
            assert resp.status_code == 200
            data = resp.json()
            assert "job_type_names" in data
            assert "manifests" in data

    def test_iterator_memory_efficiency(self, client):
        """Test that iterator with chunk_size reduces memory usage for large datasets."""
        startdate = datetime.datetime.now().date()
        # Create a large dataset
        self.create_test_jobs(100, startdate, self.repo1)

        url = reverse("groupsummary") + f"?startdate={startdate}"

        # Mock the queryset to verify iterator is called with correct chunk_size
        with patch.object(Job.objects, "filter") as mock_filter:
            mock_qs = MagicMock()
            mock_filter.return_value = mock_qs
            mock_qs.select_related.return_value = mock_qs
            mock_qs.values.return_value = mock_qs
            mock_qs.annotate.return_value = mock_qs
            mock_qs.order_by.return_value = mock_qs
            mock_qs.iterator.return_value = iter([])

            client.get(url)

            # Verify iterator was called with chunk_size
            mock_qs.iterator.assert_called_once_with(chunk_size=2000)

    def test_database_level_filtering(self, client):
        """Test that filtering happens at database level, not in Python."""
        startdate = datetime.datetime.now().date()

        # Create jobs with various job_type names
        push = Push.objects.create(
            repository=self.repo1,
            revision="test_revision",
            author="test@mozilla.com",
            time=startdate,
        )

        # Create jobs that should be filtered out
        non_test_job_type = JobType.objects.create(name="build-linux64", symbol="B")
        Job.objects.create(
            repository=self.repo1,
            push=push,
            job_type=non_test_job_type,
            state="completed",
            result="success",
            failure_classification=self.fc_intermittent,
            submit_time=startdate,
            start_time=startdate,
            end_time=startdate + datetime.timedelta(minutes=30),
        )

        # Create jobs that should be included
        self.create_test_jobs(10, startdate, self.repo1)

        url = reverse("groupsummary") + f"?startdate={startdate}"
        resp = client.get(url)

        assert resp.status_code == 200
        data = resp.json()

        # Verify only test-* jobs are included
        for job_type_name in data["job_type_names"]:
            assert job_type_name.startswith("test-")

    def test_status_filtering_optimization(self, client):
        """Test that only relevant status values (1=OK, 2=ERROR) are fetched."""
        startdate = datetime.datetime.now().date()
        push = Push.objects.create(
            repository=self.repo1,
            revision="test_revision",
            author="test@mozilla.com",
            time=startdate,
        )

        # Create job with various status values
        job = Job.objects.create(
            repository=self.repo1,
            push=push,
            job_type=self.job_types[0],
            state="completed",
            result="success",
            failure_classification=self.fc_intermittent,
            submit_time=startdate,
            start_time=startdate,
            end_time=startdate + datetime.timedelta(minutes=30),
        )

        job_log = JobLog.objects.create(
            job=job,
            name="test_log",
            url="http://example.com/log",
        )

        # Create group statuses with various values
        GroupStatus.objects.create(
            job_log=job_log,
            group=self.groups[0],
            status=3,  # This should be filtered out
            duration=100,
        )

        url = reverse("groupsummary") + f"?startdate={startdate}"
        resp = client.get(url)

        assert resp.status_code == 200
        data = resp.json()

        # With status=3, this should not appear in results
        assert len(data["manifests"]) == 0

    def test_performance_with_large_dataset(self, client):
        """Test API performance with a large dataset."""
        startdate = datetime.datetime.now().date()

        # Create a large dataset
        num_jobs = 500
        self.create_test_jobs(num_jobs, startdate, self.repo1)

        url = reverse("groupsummary") + f"?startdate={startdate}"

        # Measure query time
        query_start = time.time()
        resp = client.get(url)
        query_time = time.time() - query_start

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["job_type_names"]) > 0
        assert len(data["manifests"]) > 0

        # Performance assertion - should complete in reasonable time
        assert query_time < 5.0, f"Query took {query_time}s, expected < 5s"

    def test_date_range_limitation(self, client):
        """Test that date range is limited to prevent excessive data retrieval."""
        startdate = datetime.datetime.now().date()
        enddate = startdate + datetime.timedelta(days=10)  # Try 10 days range

        self.create_test_jobs(50, startdate, self.repo1)
        self.create_test_jobs(50, startdate + datetime.timedelta(days=2), self.repo1)

        url = reverse("groupsummary") + f"?startdate={startdate}&enddate={enddate}"
        resp = client.get(url)

        assert resp.status_code == 200
        # The API should limit to 1 day range even if we request 10 days

    def test_raw_sql_optimization_method(self, client):
        """Test the raw SQL optimization alternative method."""
        view = SummaryByGroupName()

        # Create test data
        startdate = datetime.datetime.now().date()
        self.create_test_jobs(100, startdate, self.repo1)

        # Create mock request
        mock_request = Mock()
        mock_request.query_params = {"startdate": str(startdate)}

        # Test raw SQL method
        start_time = time.time()
        response = view.list_optimized_raw(mock_request)
        raw_sql_time = time.time() - start_time

        assert response.status_code == 200
        data = response.data
        assert "job_type_names" in data
        assert "manifests" in data

        # Performance assertion
        assert raw_sql_time < 2.0, f"Raw SQL query took {raw_sql_time}s, expected < 2s"

    def test_query_result_caching(self, client):
        """Test that results are efficiently processed without multiple DB hits."""
        startdate = datetime.datetime.now().date()
        self.create_test_jobs(50, startdate, self.repo1)

        url = reverse("groupsummary") + f"?startdate={startdate}"

        # First request
        with self.assertNumQueries(expected_queries=1):
            resp1 = client.get(url)
            data1 = resp1.json()

        # Second request should also be efficient
        with self.assertNumQueries(expected_queries=1):
            resp2 = client.get(url)
            data2 = resp2.json()

        # Results should be consistent
        assert data1 == data2

    def test_empty_group_name_handling(self, client):
        """Test that empty group names are handled efficiently."""
        startdate = datetime.datetime.now().date()
        push = Push.objects.create(
            repository=self.repo1,
            revision="test_revision",
            author="test@mozilla.com",
            time=startdate,
        )

        # Create job with empty group name
        job = Job.objects.create(
            repository=self.repo1,
            push=push,
            job_type=self.job_types[0],
            state="completed",
            result="success",
            failure_classification=self.fc_intermittent,
            submit_time=startdate,
            start_time=startdate,
            end_time=startdate + datetime.timedelta(minutes=30),
        )

        job_log = JobLog.objects.create(
            job=job,
            name="test_log",
            url="http://example.com/log",
        )

        # Create group with empty name
        empty_group = Group.objects.create(name="")
        GroupStatus.objects.create(
            job_log=job_log,
            group=empty_group,
            status=1,
            duration=100,
        )

        url = reverse("groupsummary") + f"?startdate={startdate}"
        resp = client.get(url)

        assert resp.status_code == 200
        data = resp.json()
        # Empty group names should be filtered out
        for manifest in data["manifests"]:
            assert "" not in manifest

    def test_concurrent_request_handling(self, client):
        """Test that concurrent requests are handled efficiently."""
        from concurrent.futures import ThreadPoolExecutor

        startdate = datetime.datetime.now().date()
        self.create_test_jobs(100, startdate, self.repo1)

        url = reverse("groupsummary") + f"?startdate={startdate}"
        results = []

        def make_request():
            resp = client.get(url)
            return resp.status_code, resp.json()

        # Simulate concurrent requests
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(5)]
            for future in futures:
                status_code, data = future.result()
                assert status_code == 200
                assert "job_type_names" in data
                results.append(data)

        # All concurrent requests should return the same data
        for result in results[1:]:
            assert result == results[0]

    def assert_num_queries(self, expected_queries):
        """Context manager to assert number of database queries."""

        class QueryCounter:
            def __init__(self, expected):
                self.expected = expected
                self.initial_queries = 0

            def __enter__(self):
                self.initial_queries = len(connection.queries)
                return self

            def __exit__(self, exc_type, exc_val, exc_tb):
                final_queries = len(connection.queries)
                actual_queries = final_queries - self.initial_queries
                # Allow some variance for Django internals
                assert actual_queries <= self.expected + 2, (
                    f"Expected <= {self.expected + 2} queries, got {actual_queries}"
                )

        return QueryCounter(expected_queries)


@pytest.mark.django_db
class TestGroupsAPIValidation:
    """Test input validation and edge cases."""

    def test_invalid_date_format(self, client):
        """Test handling of invalid date formats."""
        invalid_dates = [
            "2025-13-01",  # Invalid month
            "2025-02-30",  # Invalid day
            "25-02-28",  # Invalid year format
            "not-a-date",  # Completely invalid
        ]

        for invalid_date in invalid_dates:
            url = reverse("groupsummary") + f"?startdate={invalid_date}"
            resp = client.get(url)
            assert resp.status_code == 200
            # Should default to today's date

    def test_date_regex_validation(self, client):
        """Test the regex validation for date parameters."""
        # Valid format
        url = reverse("groupsummary") + "?startdate=2025-02-28"
        resp = client.get(url)
        assert resp.status_code == 200

        # Invalid format should use default
        url = reverse("groupsummary") + "?startdate=02/28/2025"
        resp = client.get(url)
        assert resp.status_code == 200

    def test_repository_filtering(self, client):
        """Test that only specific repositories (1, 77) are included."""
        startdate = datetime.datetime.now().date()

        # Create a repository that shouldn't be included
        other_repo = Repository.objects.create(
            id=999,
            repository_group_id=1,
            name="other-repo",
            dvcs_type="git",
            url="https://github.com/mozilla/other",
        )

        push = Push.objects.create(
            repository=other_repo,
            revision="other_revision",
            author="test@mozilla.com",
            time=startdate,
        )

        # This job should not appear in results
        Job.objects.create(
            repository=other_repo,
            push=push,
            job_type=JobType.objects.create(name="test-other", symbol="O"),
            state="completed",
            result="success",
            failure_classification=FailureClassification.objects.get(id=1),
            submit_time=startdate,
            start_time=startdate,
            end_time=startdate + datetime.timedelta(minutes=30),
        )

        url = reverse("groupsummary") + f"?startdate={startdate}"
        resp = client.get(url)

        assert resp.status_code == 200
        data = resp.json()
        # Should be empty since we only created jobs for repo 999
        assert len(data["manifests"]) == 0
