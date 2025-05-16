import logging
import traceback
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand

from treeherder.model.models import Repository
from treeherder.perf.auto_perf_sheriffing.factories import sherlock_factory
from treeherder.perf.exceptions import MaxRuntimeExceededError
from treeherder.perf.models import PerformanceFramework

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    AVAILABLE_FRAMEWORKS = PerformanceFramework.fetch_all_names()
    AVAILABLE_REPOS = Repository.fetch_all_names()

    SHERIFFED_FRAMEWORKS = [
        "browsertime",
        "raptor",
        "talos",
        "awsy",
        "build_metrics",
        "js-bench",
        "devtools",
    ]
    SHERIFFED_REPOS = ["autoland", "mozilla-beta"]

    help = "Select most relevant alerts and identify jobs to retrigger."

    def add_arguments(self, parser):
        parser.add_argument(
            "--time-window",
            action="store",
            type=int,
            default=60,
            help="How far back to look for alerts to retrigger (expressed in minutes).",
        )

        parser.add_argument(
            "--frameworks",
            nargs="+",
            default=self.SHERIFFED_FRAMEWORKS,
            choices=self.AVAILABLE_FRAMEWORKS,
            help="Defaults to all registered performance frameworks.",
        )

        parser.add_argument(
            "--repositories",
            nargs="+",
            default=self.SHERIFFED_REPOS,
            choices=self.AVAILABLE_REPOS,
            help=f"Defaults to {self.SHERIFFED_REPOS}.",
        )

    def handle(self, *args, **options):
        frameworks, repositories, since, days_to_lookup = self._parse_args(**options)

        sherlock = sherlock_factory(days_to_lookup)
        try:
            sherlock.sheriff(since, frameworks, repositories)
            try:
                sherlock.telemetry_alert()
            except Exception as e:
                logging.warning("Failed to run telemetry alerting\n" + traceback.format_exc())
        except MaxRuntimeExceededError as ex:
            logging.info(ex)

        logging.info("Sherlock: Going back to sleep.")

    def _parse_args(self, **options) -> tuple[list, list, datetime, timedelta]:
        return (
            options["frameworks"],
            options["repositories"],
            datetime.now() - timedelta(minutes=options["time_window"]),
            timedelta(days=1),
        )
