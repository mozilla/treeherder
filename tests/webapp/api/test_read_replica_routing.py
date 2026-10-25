"""End-to-end test that ReadReplicaMixin routes a real GET to the replica alias.

Both DB aliases point at the same physical Postgres in test settings, but they
are separate connections/sessions. We therefore use ``transaction=True`` so the
``default`` connection commits its fixture writes and the ``read_replica``
connection (separate session) can see them.
"""

import pytest
from django.db import connections
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from treeherder.model.models import Job
from treeherder.perf.models import PerformanceFramework

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "read_replica"])


def test_performance_framework_list_hits_replica(client):
    PerformanceFramework.objects.create(name="talos", enabled=True)
    PerformanceFramework.objects.create(name="awsy", enabled=True)

    with CaptureQueriesContext(connections["read_replica"]) as replica_ctx:
        response = client.get(reverse("performance-frameworks-list"))

    assert response.status_code == 200
    assert len(response.json()) == 2
    assert len(replica_ctx.captured_queries) > 0, (
        "Expected PerformanceFramework reads to be routed to the replica alias"
    )


def test_performance_alert_summary_list_stays_on_default(client, test_perf_alert_summary):
    """A viewset that is *not* opted in must not route to the replica."""
    with CaptureQueriesContext(connections["read_replica"]) as replica_ctx:
        response = client.get(reverse("performance-alert-summaries-list"))

    assert response.status_code == 200
    assert len(replica_ctx.captured_queries) == 0, (
        "PerformanceAlertSummaryViewSet must remain on primary"
    )


def test_performance_signatures_list_hits_replica(client, test_perf_signature):
    with CaptureQueriesContext(connections["read_replica"]) as replica_ctx:
        response = client.get(
            reverse(
                "performance-signatures-list",
                kwargs={"project": test_perf_signature.repository.name},
            )
        )

    assert response.status_code == 200
    assert len(replica_ctx.captured_queries) > 0


def test_performance_summary_hits_replica(client, test_perf_signature):
    with CaptureQueriesContext(connections["read_replica"]) as replica_ctx:
        response = client.get(
            reverse("performance-summary")
            + f"?repository={test_perf_signature.repository.name}&interval=86400"
        )

    assert response.status_code == 200
    assert len(replica_ctx.captured_queries) > 0


# --- Jobs-view polling endpoints (JOBS_POLLING_READ_REPLICA_DESIGN.md) ---


def test_jobs_list_hits_replica(client, eleven_jobs_stored, test_repository):
    """The default /api/jobs/ polling endpoint (JobsViewSet) reads from the replica.

    The default and project-bound jobs viewsets share the ``jobs-list`` URL
    name, so we hit the default endpoint by its literal path to avoid the
    ``reverse()`` ambiguity.
    """
    with CaptureQueriesContext(connections["read_replica"]) as replica_ctx:
        response = client.get("/api/jobs/")

    assert response.status_code == 200
    assert response.json()["results"]
    assert len(replica_ctx.captured_queries) > 0, (
        "Expected JobsViewSet reads to be routed to the replica alias"
    )


def test_project_push_list_hits_replica(client, eleven_jobs_stored, test_repository):
    """The push polling endpoint (PushViewSet.list) reads from the replica."""
    with CaptureQueriesContext(connections["read_replica"]) as replica_ctx:
        response = client.get(reverse("push-list", kwargs={"project": test_repository.name}))

    assert response.status_code == 200
    assert response.json()["results"]
    assert len(replica_ctx.captured_queries) > 0, (
        "Expected PushViewSet reads to be routed to the replica alias"
    )


def test_project_jobs_detail_hits_replica(client, eleven_jobs_stored, test_repository):
    """Job detail (JobsProjectViewSet.retrieve) reads from the replica."""
    job_id = Job.objects.values_list("id", flat=True).first()

    with CaptureQueriesContext(connections["read_replica"]) as replica_ctx:
        response = client.get(
            reverse("jobs-detail", kwargs={"project": test_repository.name, "pk": job_id})
        )

    assert response.status_code == 200
    assert len(replica_ctx.captured_queries) > 0, (
        "Expected JobsProjectViewSet reads to be routed to the replica alias"
    )


def test_groupsummary_hits_replica(client, group_data):
    """The group summary aggregation (SummaryByGroupName) reads from the replica."""
    startdate = str(group_data["query_string"]).split("=")[-1]

    with CaptureQueriesContext(connections["read_replica"]) as replica_ctx:
        response = client.get(reverse("groupsummary") + f"?startdate={startdate}")

    assert response.status_code == 200
    assert response.json() == group_data["expected"]
    assert len(replica_ctx.captured_queries) > 0, (
        "Expected SummaryByGroupName reads to be routed to the replica alias"
    )
