import logging
import sys
import traceback
from contextlib import contextmanager
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from treeherder.perf.auto_perf_sheriffing.factories import sherlock_factory
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    DEFAULT_ALERT_EMAIL,
    DESKTOP,
    MOBILE,
)


class Command(BaseCommand):
    help = "Runs telemetry alerting with optional specific restrictions in place."

    def add_arguments(self, parser):
        parser.add_argument(
            "--probe",
            help=(
                "Probe name to run detection/alerting for (dots replaced with "
                "underscores, e.g. 'performance_pageload_fcp'). Defaults to all probes."
            ),
        )
        parser.add_argument(
            "--platform-type",
            choices=[DESKTOP, MOBILE],
            help=(
                f"Only run probes for this platform type ('{DESKTOP}' or "
                f"'{MOBILE}'). Defaults to both."
            ),
        )
        parser.add_argument(
            "--label",
            help=(
                "Only run detection/alerting for this label of a labeled probe "
                "(e.g. 'https'). Ignored for probes that aren't labeled. "
                "Defaults to all labels."
            ),
        )
        parser.add_argument(
            "--force-monitor",
            action="store_true",
            help=(
                "Monitor the probes even when their definition doesn't enable "
                "change detection. Any emails produced are routed to "
                f"{DEFAULT_ALERT_EMAIL} instead of the probe owners."
            ),
        )
        parser.add_argument(
            "--max-detections",
            type=int,
            default=1,
            help="Maximum number of detections to turn into alerts (default: 1).",
        )
        parser.add_argument(
            "--days-to-lookup",
            type=int,
            default=1,
            help="Days back the sherlock instance should look up (default: 1).",
        )
        parser.add_argument(
            "--keep",
            action="store_true",
            help="Keep the created DB objects (default: roll back after the run).",
        )

    @contextmanager
    def _readable_logging(self):
        """Temporarily route the `treeherder` logger through a plain console
        handler so this command's output is human-readable instead of the
        GCP-structured JSON used in production.
        """
        logger = logging.getLogger("treeherder")
        original_handlers = logger.handlers
        original_propagate = logger.propagate

        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s] %(message)s")
        )
        logger.handlers = [handler]
        logger.propagate = False
        try:
            yield
        finally:
            logger.handlers = original_handlers
            logger.propagate = original_propagate

    def handle(self, *args, **options):
        probe = options["probe"]
        max_detections = options["max_detections"]
        platform_type = options["platform_type"]
        label = options["label"]
        force_monitor = options["force_monitor"]

        self.stdout.write(
            f"Running telemetry alerting for probe '{probe or 'all'}', "
            f"platform '{platform_type or 'all'}', label '{label or 'all'}', "
            f"with max_detections={max_detections}, force_monitor={force_monitor}"
        )

        sherlock = sherlock_factory(timedelta(days=options["days_to_lookup"]))
        try:
            with self._readable_logging(), transaction.atomic():
                sherlock.telemetry_alert(
                    probe_filter=probe,
                    max_detections=max_detections,
                    platform_filter=platform_type,
                    label_filter=label,
                    force_monitor=force_monitor,
                )

                if not options["keep"]:
                    self.stdout.write("Rolling back DB changes (use --keep to retain them).")
                    transaction.set_rollback(True)
                else:
                    self.stdout.write("Keeping DB changes.")
        except Exception as e:
            self.stderr.write(traceback.format_exc())
            raise CommandError(
                f"Failed to run telemetry alerting for '{probe or 'all'}': {e}"
            ) from e

        self.stdout.write(self.style.SUCCESS("Done."))
