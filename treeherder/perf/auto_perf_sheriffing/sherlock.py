import logging
import os
import traceback
from datetime import datetime, time, timedelta, timezone
from json import JSONDecodeError, loads
from logging import INFO, WARNING

import requests
from django.conf import settings
from django.db.models import QuerySet
from taskcluster.helper import TaskclusterConfig

from treeherder.perf.auto_perf_sheriffing.backfill_reports import (
    BackfillReportMaintainer,
)
from treeherder.perf.auto_perf_sheriffing.backfill_tool import BackfillTool
from treeherder.perf.auto_perf_sheriffing.secretary import Secretary
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
    TelemetryAlertFactory,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager import (
    TelemetryAlertManager,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.probe import (
    TelemetryProbe,
    TelemetryProbeValidationError,
)
from treeherder.perf.exceptions import CannotBackfillError, MaxRuntimeExceededError
from treeherder.perf.models import (
    BackfillNotificationRecord,
    BackfillRecord,
    BackfillReport,
    PerformanceFramework,
    PerformanceTelemetryAlert,
    PerformanceTelemetryAlertSummary,
    PerformanceTelemetrySignature,
    Push,
    Repository,
)

logger = logging.getLogger(__name__)

CLIENT_ID = settings.PERF_SHERIFF_BOT_CLIENT_ID
ACCESS_TOKEN = settings.PERF_SHERIFF_BOT_ACCESS_TOKEN

BUILDID_MAPPING = "https://hg.mozilla.org/mozilla-central/json-firefoxreleases"

INITIAL_PROBES = (
    "memory_ghost_windows",
    "cycle_collector_time",
    "mouseup_followed_by_click_present_latency",
    "network_tcp_connection",
    "network_tls_handshake",
    "networking_http_channel_page_open_to_first_sent",
    "performance_pageload_fcp",
    "perf_largest_contentful_paint",
    "performance_interaction_keypress_present_latency",
    "gfx_content_full_paint_time",
    "paint_build_displaylist_time",
)


class Sherlock:
    """
    Robot variant of a performance sheriff (the main class)

    Automates backfilling of skipped perf jobs.
    """

    DEFAULT_MAX_RUNTIME = timedelta(minutes=50)

    def __init__(
        self,
        report_maintainer: BackfillReportMaintainer,
        backfill_tool: BackfillTool,
        secretary: Secretary,
        max_runtime: timedelta = None,
        supported_platforms: list[str] = None,
    ):
        self.report_maintainer = report_maintainer
        self.backfill_tool = backfill_tool
        self.secretary = secretary
        self._max_runtime = self.DEFAULT_MAX_RUNTIME if max_runtime is None else max_runtime

        self.supported_platforms = supported_platforms or settings.SUPPORTED_PLATFORMS
        self._wake_up_time = datetime.now()
        self._buildid_mappings = {}

    def sheriff(self, since: datetime, frameworks: list[str], repositories: list[str]):
        logger.info("Sherlock: Validating settings...")
        self.secretary.validate_settings()

        logger.info("Sherlock: Marking reports for backfill...")
        self.secretary.mark_reports_for_backfill()
        self.assert_can_run()

        # secretary checks the status of all backfilled jobs
        self.secretary.check_outcome()
        self.assert_can_run()

        # reporter tool should always run *(only handles preliminary records/reports)*
        logger.info("Sherlock: Reporter tool is creating/maintaining  reports...")
        self._report(since, frameworks, repositories)
        self.assert_can_run()

        # backfill tool follows
        logger.info("Sherlock: Starting to backfill...")
        self._backfill(frameworks, repositories)
        self.assert_can_run()

    def runtime_exceeded(self) -> bool:
        elapsed_runtime = datetime.now() - self._wake_up_time
        return self._max_runtime <= elapsed_runtime

    def assert_can_run(self):
        if self.runtime_exceeded():
            raise MaxRuntimeExceededError("Sherlock: Max runtime exceeded.")

    def _report(
        self, since: datetime, frameworks: list[str], repositories: list[str]
    ) -> list[BackfillReport]:
        return self.report_maintainer.provide_updated_reports(since, frameworks, repositories)

    def _backfill(self, frameworks: list[str], repositories: list[str]):
        for platform in self.supported_platforms:
            self.__backfill_on(platform, frameworks, repositories)

    def __backfill_on(self, platform: str, frameworks: list[str], repositories: list[str]):
        left = self.secretary.backfills_left(on_platform=platform)
        total_consumed = 0

        records_to_backfill = self.__fetch_records_requiring_backfills_on(
            platform, frameworks, repositories
        )
        logger.info(
            f"Sherlock: {records_to_backfill.count()} records found to backfill on {platform.title()}."
        )

        for record in records_to_backfill:
            if left <= 0 or self.runtime_exceeded():
                break
            left, consumed = self._backfill_record(record, left)
            logger.info(f"Sherlock: Backfilled record with id {record.alert.id}.")
            # Model used for reporting backfill outcome
            BackfillNotificationRecord.objects.create(record=record)
            total_consumed += consumed

        self.secretary.consume_backfills(platform, total_consumed)
        logger.info(f"Sherlock: Consumed {total_consumed} backfills for {platform.title()}.")
        logger.debug(f"Sherlock: Having {left} backfills left on {platform.title()}.")

    @staticmethod
    def __fetch_records_requiring_backfills_on(
        platform: str, frameworks: list[str], repositories: list[str]
    ) -> QuerySet:
        records_to_backfill = BackfillRecord.objects.select_related(
            "alert",
            "alert__series_signature",
            "alert__series_signature__platform",
            "alert__summary__framework",
            "alert__summary__repository",
        ).filter(
            status=BackfillRecord.READY_FOR_PROCESSING,
            alert__series_signature__platform__platform__icontains=platform,
            alert__summary__framework__name__in=frameworks,
            alert__summary__repository__name__in=repositories,
        )
        return records_to_backfill

    def _backfill_record(self, record: BackfillRecord, left: int) -> tuple[int, int]:
        consumed = 0

        try:
            context = record.get_context()
        except JSONDecodeError:
            logger.warning(f"Failed to backfill record {record.alert.id}: invalid JSON context.")
            record.status = BackfillRecord.FAILED
            record.save()
        else:
            data_points_to_backfill = self.__get_data_points_to_backfill(context)
            for data_point in data_points_to_backfill:
                if left <= 0 or self.runtime_exceeded():
                    break
                try:
                    using_job_id = data_point["job_id"]
                    self.backfill_tool.backfill_job(using_job_id)
                    left, consumed = left - 1, consumed + 1
                except (KeyError, CannotBackfillError, Exception) as ex:
                    logger.debug(f"Failed to backfill record {record.alert.id}: {ex}")
                else:
                    record.try_remembering_job_properties(using_job_id)

            success, outcome = self._note_backfill_outcome(
                record, len(data_points_to_backfill), consumed
            )
            log_level = INFO if success else WARNING
            logger.log(log_level, f"{outcome} (for backfill record {record.alert.id})")

        return left, consumed

    @staticmethod
    def _note_backfill_outcome(
        record: BackfillRecord, to_backfill: int, actually_backfilled: int
    ) -> tuple[bool, str]:
        success = False

        record.total_actions_triggered = actually_backfilled

        if actually_backfilled == to_backfill:
            record.status = BackfillRecord.BACKFILLED
            success = True
            outcome = "Backfilled all data points"
        else:
            record.status = BackfillRecord.FAILED
            if actually_backfilled == 0:
                outcome = "Backfill attempts on all data points failed right upon request."
            elif actually_backfilled < to_backfill:
                outcome = "Backfill attempts on some data points failed right upon request."
            else:
                raise ValueError(
                    f"Cannot have backfilled more than available attempts ({actually_backfilled} out of {to_backfill})."
                )

        record.set_log_details({"action": "BACKFILL", "outcome": outcome})
        record.save()
        return success, outcome

    @staticmethod
    def _is_queue_overloaded(provisioner_id: str, worker_type: str, acceptable_limit=100) -> bool:
        """
        Helper method for Sherlock to check load on processing queue.
        Usage example: _queue_is_too_loaded('gecko-3', 'b-linux')
        :return: True/False
        """
        tc = TaskclusterConfig("https://firefox-ci-tc.services.mozilla.com")
        tc.auth(client_id=CLIENT_ID, access_token=ACCESS_TOKEN)
        queue = tc.get_service("queue")

        pending_tasks_count = queue.pendingTasks(provisioner_id, worker_type).get("pendingTasks")

        return pending_tasks_count > acceptable_limit

    @staticmethod
    def __get_data_points_to_backfill(context: list[dict]) -> list[dict]:
        context_len = len(context)
        start = None

        if context_len == 1:
            start = 0
        elif context_len > 1:
            start = 1

        return context[start:]

    def telemetry_alert(self):
        if not self._can_run_telemetry():
            return
        if not settings.TELEMETRY_ENABLE_ALERTS:
            logger.info("Telemetry alerting is disabled. Enable it with TELEMETRY_ENABLE_ALERTS=1")
            return

        import mozdetect
        from mozdetect.telemetry_query import get_metric_table

        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") and self._is_prod():
            raise Exception(
                "GOOGLE_APPLICATION_CREDENTIALS must be defined in production. "
                "Use GCLOUD_DIR for local testing."
            )

        project = "mozdata"
        if self._is_prod():
            # Defined from the GCLOUD_PROJECT env variable
            project = None

        ts_detectors = mozdetect.get_timeseries_detectors()

        metric_definitions = self._get_metric_definitions()

        probes = {}
        alerts = []
        repository = Repository.objects.get(name="mozilla-central")
        framework = PerformanceFramework.objects.get(name="telemetry")
        for metric_info in metric_definitions:
            if metric_info["platform"] == "mobile":
                # Skip mobile detection since it's currently broken
                continue
            if metric_info["name"] not in INITIAL_PROBES:
                continue
            try:
                probe = TelemetryProbe(metric_info)
            except TelemetryProbeValidationError as e:
                logger.warning(f"Failed probe validation: {str(e)}")
                continue

            if not probe.should_detect_changes():
                # We should not currently be skipping probes since we're
                # only detecting changes on the allowlisted ones. Later, this
                # should be a continue
                probe.monitor_info["detect_changes"] = True
            probes.setdefault(probe.name, probe)

            logger.info(f"Running detection for {probe.name}")
            cdf_ts_detector = ts_detectors[probe.get_change_detection_technique()]

            for platform in ("Windows",):
                logger.info(f"On Platform {platform}")
                try:
                    data = get_metric_table(
                        probe.name,
                        platform,
                        android=(platform == "Mobile"),
                        use_fog=True,
                        project=project,
                    )
                    if data.empty:
                        logger.info("No data found")
                        continue

                    timeseries = mozdetect.TelemetryTimeSeries(data)

                    ts_detector = cdf_ts_detector(timeseries)
                    detections = ts_detector.detect_changes()

                    for detection in detections:
                        # Only get buildids if there might be a detection
                        if not self._buildid_mappings:
                            self._make_buildid_to_date_mapping()
                        alert = self._create_detection_alert(
                            detection, probe, platform, repository, framework
                        )
                        if alert:
                            alerts.append(alert)
                except Exception:
                    logger.info(f"Failed: {traceback.format_exc()}")

        if alerts:
            alert_manager = TelemetryAlertManager(probes)
            alert_manager.manage_alerts(alerts)

    def _is_prod(self):
        return settings.SITE_HOSTNAME == "treeherder.mozilla.org"

    def _can_run_telemetry(self):
        return not self._is_prod() or (time(22, 0) <= datetime.utcnow().time() < time(23, 0))

    def _create_detection_alert(
        self,
        detection: object,
        probe: TelemetryProbe,
        platform: str,
        repository: Repository,
        framework: PerformanceFramework,
    ):
        # Get, or create the signature
        # TODO: Allow multiple channels, legacy probes, and different apps
        probe_signature, _ = PerformanceTelemetrySignature.objects.update_or_create(
            channel="Nightly",
            platform=platform,
            probe=probe.name,
            probe_type="Glean",
            application="Firefox",
        )

        detection_date = str(detection.location)
        if detection_date not in self._buildid_mappings[platform]:
            # TODO: See if we should expand the range in this situation
            detection_date = self._find_closest_build_date(detection_date, platform)

        detection_build = self._buildid_mappings[platform][detection_date]
        prev_build = self._buildid_mappings[platform][detection_build["prev_build"]]
        next_build = self._buildid_mappings[platform][detection_build["next_build"]]

        # Get the pushes for these builds
        detection_push = Push.objects.get(
            revision=detection_build["node"], repository__name=repository.name
        )
        prev_push = Push.objects.get(revision=prev_build["node"], repository__name=repository.name)
        next_push = Push.objects.get(revision=next_build["node"], repository__name=repository.name)

        # Check that an alert summary doesn't already exist around this point (+/- 1 day)
        latest_timestamp = next_push.time + timedelta(days=1)
        oldest_timestamp = next_push.time - timedelta(days=1)
        try:
            detection_summary = PerformanceTelemetryAlertSummary.objects.filter(
                repository=repository,
                framework=framework,
                push__time__gte=oldest_timestamp,
                push__time__lte=latest_timestamp,
            ).latest("push__time")
        except PerformanceTelemetryAlertSummary.DoesNotExist:
            detection_summary = None

        if not detection_summary:
            # Create an alert summary to capture all alerts
            # that occurred on the same date range
            detection_summary, _ = PerformanceTelemetryAlertSummary.objects.get_or_create(
                repository=repository,
                framework=framework,
                prev_push=prev_push,
                push=next_push,
                original_push=detection_push,
                sheriffed=False,
                defaults={
                    "manually_created": False,
                    "created": datetime.now(timezone.utc),
                },
            )

        try:
            detection_alert = PerformanceTelemetryAlert.objects.get(
                summary_id=detection_summary.id, series_signature_id=probe_signature.id
            )
        except PerformanceTelemetryAlert.DoesNotExist:
            detection_alert = None

        if not detection_alert:
            detection_alert, _ = PerformanceTelemetryAlert.objects.update_or_create(
                summary_id=detection_summary.id,
                series_signature=probe_signature,
                defaults={
                    "is_regression": True,
                    "amount_pct": round(
                        (100.0 * abs(detection.new_value - detection.previous_value))
                        / float(detection.previous_value),
                        2,
                    ),
                    "amount_abs": abs(detection.new_value - detection.previous_value),
                    "sustained": True,
                    "direction": detection.direction,
                    "confidence": detection.confidence,
                    "prev_value": detection.previous_value,
                    "new_value": detection.new_value,
                    "prev_median": detection.optional_detection_info["Interpolated Median"][0],
                    "new_median": detection.optional_detection_info["Interpolated Median"][1],
                    "prev_p05": detection.optional_detection_info["Interpolated p05"][0],
                    "new_p05": detection.optional_detection_info["Interpolated p05"][1],
                    "prev_p95": detection.optional_detection_info["Interpolated p95"][0],
                    "new_p95": detection.optional_detection_info["Interpolated p95"][1],
                },
            )

            return TelemetryAlertFactory.construct_alert(
                telemetry_alert=detection_alert,
                telemetry_alert_summary=detection_summary,
                telemetry_signature=probe_signature,
            )

    def _get_metric_definitions(self) -> list[dict]:
        metric_definition_urls = [
            ("https://dictionary.telemetry.mozilla.org/data/firefox_desktop/index.json", "desktop"),
            ("https://dictionary.telemetry.mozilla.org/data/fenix/index.json", "mobile"),
        ]

        merged_metrics = []

        for url, platform in metric_definition_urls:
            try:
                logger.info(f"Getting probes from {url}")
                response = requests.get(url)
                response.raise_for_status()

                data = response.json()
                metrics = data.get("metrics", [])
                for metric in metrics:
                    merged_metrics.append(
                        {
                            "name": metric["name"].replace(".", "_"),
                            "data": metric,
                            "platform": platform,
                        }
                    )

                logger.info(f"Found {len(metrics)} probes")
            except requests.RequestException as e:
                logger.info(f"Failed to fetch from {url}: {e}")
            except ValueError:
                logger.info(f"Invalid JSON from {url}")

        return merged_metrics

    def _make_buildid_to_date_mapping(self):
        # Always returned in order of newest to oldest, only capture
        # the newest build for each day, and ignore others. This can
        # differ between platforms too (e.g. failed builds)
        buildid_mappings = self._get_buildid_mappings()

        prev_date = {}
        for build in buildid_mappings["builds"]:
            platform = self._replace_platform_build_name(build["platform"])
            if not platform:
                continue
            curr_date = str(datetime.strptime(build["buildid"][:8], "%Y%m%d").date())

            platform_builds = self._buildid_mappings.setdefault(platform, {})
            if curr_date not in platform_builds:
                platform_builds[curr_date] = build

                if prev_date.get(platform):
                    platform_builds[prev_date[platform]]["prev_build"] = curr_date
                    platform_builds[curr_date]["next_build"] = prev_date[platform]
                else:
                    platform_builds[curr_date]["next_build"] = curr_date

            prev_date[platform] = curr_date

    def _get_buildid_mappings(self) -> dict:
        try:
            response = requests.get(BUILDID_MAPPING)
            response.raise_for_status()
            return loads(response.content)
        except requests.RequestException as e:
            raise Exception(f"Failed to download buildid mappings, cannot produce detections: {e}")

    def _replace_platform_build_name(self, platform: str) -> str:
        if platform == "win64":
            return "Windows"
        if platform == "linux64":
            return "Linux"
        if platform == "mac":
            return "Darwin"
        return ""

    def _find_closest_build_date(self, detection_date: str, platform: str) -> str:
        # Get the closest date to the detection date
        prev_date = None

        for date in sorted(list(self._buildid_mappings[platform].keys())):
            if date > detection_date:
                break
            prev_date = date

        return prev_date
