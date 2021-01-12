import logging
from argparse import ArgumentError
from datetime import datetime, timedelta
from typing import List, Tuple

from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.perf.alerts import (
    AlertsPicker,
    BackfillReportMaintainer,
    IdentifyAlertRetriggerables,
)
from treeherder.perf.backfill_tool import BackfillTool
from treeherder.perf.exceptions import MaxRuntimeExceeded
from treeherder.perf.secretary_tool import SecretaryTool
from treeherder.perf.models import PerformanceFramework
from treeherder.perf.perf_sheriff_bot import PerfSheriffBot
from treeherder.services.taskcluster import DEFAULT_ROOT_URL as root_url
from treeherder.services.taskcluster import TaskclusterModelProxy

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    repos_to_retrigger_on = ['autoland', 'mozilla-inbound', 'mozilla-beta']
    help = "Select most relevant alerts and identify jobs to retrigger."

    def add_arguments(self, parser):
        parser.add_argument(
            '--time-window',
            action='store',
            type=int,
            default=60,
            help="How far back to look for alerts to retrigger (expressed in minutes).",
        )

        parser.add_argument(
            '--frameworks',
            nargs='+',
            default=None,
            help="Defaults to all registered performance frameworks.",
        )

        parser.add_argument(
            '--repositories',
            nargs='+',
            default=Command.repos_to_retrigger_on,
            help=f"Defaults to {Command.repos_to_retrigger_on}.",
        )

    def handle(self, *args, **options):
        frameworks, repositories, since, days_to_lookup = self._parse_args(**options)
        self._validate_args(frameworks, repositories)
        client_id = settings.PERF_SHERIFF_BOT_CLIENT_ID
        access_token = settings.PERF_SHERIFF_BOT_ACCESS_TOKEN

        alerts_picker = AlertsPicker(
            max_alerts=5,
            max_improvements=2,
            platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
        )
        backfill_context_fetcher = IdentifyAlertRetriggerables(
            max_data_points=5, time_interval=days_to_lookup
        )
        report_maintainer = BackfillReportMaintainer(alerts_picker, backfill_context_fetcher)

        # TODO: Replace proxy with real subject, once the soft launch is complete
        backfill_tool = BackfillTool(TaskclusterModelProxy(root_url, client_id, access_token))
        secretary_tool = SecretaryTool()

        try:
            perf_sheriff_bot = PerfSheriffBot(report_maintainer, backfill_tool, secretary_tool)
            perf_sheriff_bot._report(since, frameworks, repositories)
        except MaxRuntimeExceeded as ex:
            logging.info(ex)
            logging.info('PerfSheriffBot went back to sleep')

    def _parse_args(self, **options) -> Tuple[List, List, datetime, timedelta]:
        return (
            options['frameworks'],
            options['repositories'],
            datetime.now() - timedelta(minutes=options['time_window']),
            timedelta(days=1),
        )

    def _validate_args(self, frameworks: List[str], repositories: List[str]):
        if frameworks:
            available_frameworks = set(PerformanceFramework.objects.values_list('name', flat=True))
            if not set(frameworks).issubset(available_frameworks):
                raise ArgumentError('Unknown framework provided.')
        if repositories:
            if not set(repositories).issubset(set(Command.repos_to_retrigger_on)):
                raise ArgumentError('Unknown repository provided.')
