from copy import copy, deepcopy
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
import simplejson as json
import taskcluster
from freezegun import freeze_time

from tests.conftest import (
    SampleDataJSONLoader,
    create_perf_alert,
    create_perf_signature,
)
from treeherder.model.models import Job, JobGroup, JobType, MachinePlatform
from treeherder.perf.auto_perf_sheriffing.secretary import Secretary
from treeherder.perf.models import (
    BackfillRecord,
    BackfillReport,
    PerformanceAlert,
    PerformanceSettings,
    PerformanceSignature,
)

# For testing Sherlock
from treeherder.services.taskcluster import notify_client_factory
from treeherder.utils import default_serializer

load_json_fixture = SampleDataJSONLoader("sherlock")


@pytest.fixture(scope="module")
def record_context_sample():
    # contains 5 data points that can be backfilled
    return load_json_fixture("recordContext.json")


@pytest.fixture(params=["totally_broken_json", "missing_job_fields", "null_job_fields"])
def broken_context_str(record_context_sample: dict, request) -> list:
    context_str = json.dumps(record_context_sample)
    specific = request.param

    if specific == "totally_broken_json":
        return copy(context_str).replace(r'"', "<")

    else:
        record_copy = deepcopy(record_context_sample)
        if specific == "missing_job_fields":
            for data_point in record_copy:
                del data_point["job_id"]

        elif specific == "null_job_fields":
            for data_point in record_copy:
                data_point["job_id"] = None
        return json.dumps(record_copy)


@pytest.fixture(params=["preliminary", "from_non_linux"])
def record_unsuited_for_backfill(test_perf_alert, request):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)

    if request.param == "preliminary":
        return BackfillRecord.objects.create(alert=test_perf_alert, report=report)
    elif request.param == "from_non_linux":
        # test_perf_alert originates from wind platform, by default
        return BackfillRecord.objects.create(
            alert=test_perf_alert, report=report, status=BackfillRecord.READY_FOR_PROCESSING
        )


@pytest.fixture
def record_with_job_symbol(test_perf_alert):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)

    job_group = JobGroup.objects.create(
        symbol="Btime", name="Browsertime performance tests on Firefox"
    )
    job_type = JobType.objects.create(symbol="Bogo", name="Bogo tests")
    return BackfillRecord.objects.create(
        alert=test_perf_alert,
        report=report,
        job_type=job_type,
        job_group=job_group,
        job_tier=2,
    )


@pytest.fixture(params=["no_job_tier", "no_job_group", "no_job_type"])
def record_with_missing_job_symbol_components(record_with_job_symbol, request):
    if request.param == "no_job_tier":
        record_with_job_symbol.job_tier = None
        record_with_job_symbol.save()
    elif request.param == "no_job_group":
        record_with_job_symbol.job_group = None
        record_with_job_symbol.save()
    elif request.param == "no_job_type":
        record_with_job_symbol.job_type = None
        record_with_job_symbol.save()

    return record_with_job_symbol


def prepare_record_with_search_str(record_with_job_symbol, search_str_with):
    if search_str_with == "no_job_group":
        record_with_job_symbol.job_group = None
        record_with_job_symbol.save()
    elif search_str_with == "no_job_type":
        record_with_job_symbol.job_type = None
        record_with_job_symbol.save()

    return record_with_job_symbol


@pytest.fixture(params=["windows", "linux", "osx"])
def platform_specific_signature(
    test_repository, test_perf_framework, request
) -> PerformanceSignature:
    new_platform = MachinePlatform.objects.create(
        os_name=request.param, platform=request.param, architecture="x86"
    )
    return create_perf_signature(test_perf_framework, test_repository, new_platform)


@pytest.fixture
def platform_specific_perf_alert(
    platform_specific_signature, test_perf_alert_summary
) -> PerformanceAlert:
    return create_perf_alert(
        summary=test_perf_alert_summary, series_signature=platform_specific_signature
    )


@pytest.fixture
def record_ready_for_processing(platform_specific_perf_alert, record_context_sample):
    report = BackfillReport.objects.create(summary=platform_specific_perf_alert.summary)
    record = BackfillRecord.objects.create(
        alert=platform_specific_perf_alert,
        report=report,
        status=BackfillRecord.READY_FOR_PROCESSING,
    )
    record.set_context(record_context_sample)
    record.save()
    return record


@pytest.fixture
def record_from_mature_report(test_perf_alert_2):
    # create a record from a mature report
    date_past = datetime.utcnow() - timedelta(hours=10)

    with freeze_time(date_past):
        report = BackfillReport.objects.create(summary=test_perf_alert_2.summary)
        record = BackfillRecord.objects.create(alert=test_perf_alert_2, report=report)

    return record


@pytest.fixture
def report_maintainer_mock():
    return type("", (), {"provide_updated_reports": lambda *params: []})


@pytest.fixture
def backfill_tool_mock():
    def backfill_job(job_id):
        if job_id is None:
            raise Job.DoesNotExist
        return "RANDOM_TASK_ID"

    return type("", (), {"backfill_job": backfill_job})


@pytest.fixture
def secretary():
    return Secretary()


@pytest.fixture
def sherlock_settings(secretary, db):
    secretary.validate_settings()
    return PerformanceSettings.objects.get(name="perf_sheriff_bot")


@pytest.fixture
def empty_sheriff_settings(secretary):
    all_of_them = 1_000_000_000
    secretary.validate_settings()
    secretary.consume_backfills(on_platform="linux", amount=all_of_them)
    secretary.consume_backfills(on_platform="windows", amount=all_of_them)
    secretary.consume_backfills(on_platform="osx", amount=all_of_them)
    return PerformanceSettings.objects.get(name="perf_sheriff_bot")


# For testing Secretary
@pytest.fixture
def performance_settings(db):
    settings = {
        "limits": 500,
        "last_reset_date": datetime.utcnow(),
    }
    return PerformanceSettings.objects.create(
        name="perf_sheriff_bot",
        settings=json.dumps(settings, default=default_serializer),
    )


@pytest.fixture
def expired_performance_settings(db):
    settings = {
        "limits": 500,
        "last_reset_date": datetime.utcnow() - timedelta(days=30),
    }
    return PerformanceSettings.objects.create(
        name="perf_sheriff_bot",
        settings=json.dumps(settings, default=default_serializer),
    )


@pytest.fixture
def create_record():
    def _create_record(alert):
        report = BackfillReport.objects.create(summary=alert.summary)
        return BackfillRecord.objects.create(alert=alert, report=report)

    return _create_record


@pytest.fixture
def notify_client_mock() -> taskcluster.Notify:
    return MagicMock(
        spec=notify_client_factory("https://fakerooturl.org", "FAKE_CLIENT_ID", "FAKE_ACCESS_TOKEN")
    )


class Response:
    def __init__(self):
        self.status_code = 200


@pytest.fixture
def tc_notify_mock(monkeypatch):
    from treeherder.services import taskcluster as tc_services

    mock = MagicMock()
    response = Response()
    mock.email.return_value = {"response": response}

    def mockreturn(*arg, **kwargs):
        nonlocal mock
        return mock

    monkeypatch.setattr(tc_services, "notify_client_factory", mockreturn)
    return mock


@pytest.fixture
def job_from_try(hundred_job_blobs, create_jobs):
    job_blob = hundred_job_blobs[0]
    job = create_jobs([job_blob])[0]

    job.repository.is_try_repo = True
    job.repository.save()
    return job


@pytest.fixture
def mock_bugfiler_settings(monkeypatch):
    """Mock Django settings for Bugfiler API."""
    monkeypatch.setattr(
        "treeherder.perf.auto_perf_sheriffing.base_bug_manager.settings.BUGFILER_API_URL",
        "https://bugzilla.mozilla.org",
    )
    monkeypatch.setattr(
        "treeherder.perf.auto_perf_sheriffing.base_bug_manager.settings.BUGFILER_API_KEY",
        "test-api-key",
    )
    monkeypatch.setattr(
        "treeherder.perf.auto_perf_sheriffing.base_bug_manager.settings.COMMENTER_API_KEY",
        "test-commenter-key",
    )
    monkeypatch.setattr(
        "treeherder.perf.auto_perf_sheriffing.base_bug_manager.settings.SITE_HOSTNAME",
        "treeherder.mozilla.org",
    )
