import logging
import traceback
from datetime import UTC, datetime
from unittest.mock import Mock

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from treeherder.model.models import Push, Repository
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
    TelemetryAlertFactory,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.bug_manager import (
    TelemetryBugContent,
    TelemetryBugManager,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    DEFAULT_ALERT_EMAIL,
    DEFAULT_BUGZILLA_INFO,
)
from treeherder.perf.models import (
    PerformanceFramework,
    PerformanceTelemetryAlert,
    PerformanceTelemetryAlertSummary,
    PerformanceTelemetrySignature,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Creates a test telemetry alert and files a test bug on Bugzilla."

    def add_arguments(self, parser):
        parser.add_argument(
            "--alert-id",
            type=int,
            help="Use an existing PerformanceTelemetryAlert by ID instead of creating one.",
        )
        parser.add_argument(
            "--email",
            default=DEFAULT_ALERT_EMAIL,
            help="Email address to use for the needinfo on the test bug.",
        )
        parser.add_argument(
            "--probe",
            default="test_probe_metric",
            help="Probe name to use when creating the test alert.",
        )
        parser.add_argument(
            "--channel",
            default="Nightly",
            choices=["Nightly", "Beta", "Release"],
            help="Channel for the test signature.",
        )
        parser.add_argument(
            "--platform",
            default="Linux",
            help="Platform for the test signature.",
        )
        parser.add_argument(
            "--product",
            default=DEFAULT_BUGZILLA_INFO[0],
            help="Bugzilla product to file the test bug under.",
        )
        parser.add_argument(
            "--component",
            default=DEFAULT_BUGZILLA_INFO[1],
            help="Bugzilla component to file the test bug under.",
        )
        parser.add_argument(
            "--time-unit",
            default="",
            help=(
                "Time unit for the probe values in the bug content. Values are "
                "treated as nanoseconds and converted to this unit; leave empty "
                "to display the raw seeded values."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print the bug content to stdout without filing it.",
        )
        parser.add_argument(
            "--keep",
            action="store_true",
            help="Keep the created test DB objects (default: roll back after producing the bug).",
        )

    def handle(self, *args, **options):
        if options["alert_id"]:
            self._run_from_existing_alert(options)
        else:
            self._run_with_new_alert(options)

    def _build_mock_probe(self, probe_name, options):
        probe = Mock()
        probe.name = probe_name
        probe.time_unit = options["time_unit"]
        probe.get_notification_emails.return_value = [options["email"]]
        probe.get_bugzilla_info.return_value = (options["product"], options["component"])
        probe.should_file_bug.return_value = True
        probe.should_email.return_value = False
        return probe

    def _run_from_existing_alert(self, options):
        try:
            alert_row = PerformanceTelemetryAlert.objects.get(id=options["alert_id"])
        except PerformanceTelemetryAlert.DoesNotExist:
            raise CommandError(f"No PerformanceTelemetryAlert found with id={options['alert_id']}")

        alert = TelemetryAlertFactory.construct_alert(alert_row)
        probe = self._build_mock_probe(alert.telemetry_signature.probe, options)
        self._produce_bug(probe, alert, options["dry_run"])

    def _run_with_new_alert(self, options):
        try:
            with transaction.atomic():
                alert = self._create_test_alert(options)
                probe = self._build_mock_probe(options["probe"], options)
                self._produce_bug(probe, alert, options["dry_run"])

                if not options["keep"]:
                    logger.info("Rolling back test objects (use --keep to retain them).")
                    transaction.set_rollback(True)
                else:
                    logger.info(
                        f"Test alert created (id={alert.telemetry_alert.id}, "
                        f"summary_id={alert.telemetry_alert_summary.id})."
                    )
        except CommandError:
            raise
        except Exception as e:
            logger.error(traceback.format_exc())
            raise CommandError(f"Failed to create test alert: {e}") from e

    def _create_test_alert(self, options):
        repo = (
            Repository.objects.filter(name="mozilla-central").first() or Repository.objects.first()
        )
        if not repo:
            raise CommandError(
                "No repositories found in the database. Ensure the DB has been populated."
            )

        framework = (
            PerformanceFramework.objects.filter(name="telemetry").first()
            or PerformanceFramework.objects.first()
        )
        if not framework:
            raise CommandError(
                "No performance frameworks found in the database. Ensure the DB has been populated."
            )

        pushes = list(Push.objects.filter(repository=repo).order_by("-time")[:2])
        if len(pushes) < 2:
            raise CommandError(
                f"Need at least 2 pushes in repository '{repo.name}' to create a test alert."
            )

        prev_push, detection_push = pushes[1], pushes[0]

        logger.info(
            f"Creating test alert: probe={options['probe']}, "
            f"channel={options['channel']}, platform={options['platform']}, "
            f"repo={repo.name}"
        )

        signature, _ = PerformanceTelemetrySignature.objects.get_or_create(
            channel=options["channel"],
            probe=options["probe"],
            probe_type="Glean",
            platform=options["platform"],
            application="Firefox",
        )

        summary, _ = PerformanceTelemetryAlertSummary.objects.get_or_create(
            repository=repo,
            framework=framework,
            prev_push=prev_push,
            push=detection_push,
            defaults={
                "original_push": detection_push,
                "manually_created": False,
                "created": datetime.now(UTC),
            },
        )

        alert_row, _ = PerformanceTelemetryAlert.objects.get_or_create(
            summary=summary,
            series_signature=signature,
            defaults={
                "is_regression": True,
                "amount_pct": 12.5,
                "amount_abs": 85.0,
                "prev_value": 500.0,
                "new_value": 585.0,
                "sustained": True,
                "direction": "increase",
                "confidence": 0.97,
                "prev_median": 500.0,
                "new_median": 585.0,
                "prev_p05": 450.0,
                "new_p05": 530.0,
                "prev_p95": 550.0,
                "new_p95": 640.0,
            },
        )

        return TelemetryAlertFactory.construct_alert(alert_row)

    def _produce_bug(self, probe, alert, dry_run):
        bug_content = TelemetryBugContent().build_bug_content(probe, alert)

        logger.info(
            f"\n{'=' * 60}\nProduct:   {probe.get_bugzilla_info()[0]}\n"
            f"Component: {probe.get_bugzilla_info()[1]}\n"
            f"Summary:   {bug_content['title']}\n{'-' * 60}\n"
            f"{bug_content['description']}\n{'=' * 60}\n"
        )

        if dry_run:
            logger.warning("Dry run: bug not filed.")
            return

        try:
            bug_manager = TelemetryBugManager()
            bug_info = bug_manager.file_bug(probe, alert)
            logger.info(f"Filed bug {bug_info['id']}.")
        except Exception as e:
            raise CommandError(f"Failed to file bug via Bugzilla: {e}") from e
