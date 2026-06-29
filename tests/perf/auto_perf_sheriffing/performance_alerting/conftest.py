import datetime

import pytest

from treeherder.perf.models import PerformanceAlertSummary


@pytest.fixture
def test_perf_alert_summary_for_modifier(
    test_repository, push_stored, test_perf_framework, test_issue_tracker
):
    return PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.datetime.now(),
        bug_number=None,
    )


@pytest.fixture
def create_perf_alert_summary(
    test_repository, test_perf_framework, push_stored, test_issue_tracker
):
    counter = {"value": 3}

    def _create_summary(**kwargs):
        push_id = counter["value"]
        counter["value"] += 1
        defaults = {
            "repository": test_repository,
            "framework": test_perf_framework,
            "prev_push_id": push_id,
            "push_id": push_id + 1,
            "manually_created": False,
            "created": datetime.datetime.now(),
            "bug_number": None,
        }
        defaults.update(kwargs)
        return PerformanceAlertSummary.objects.create(**defaults)

    return _create_summary
