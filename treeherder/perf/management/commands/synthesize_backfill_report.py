from argparse import ArgumentError
from datetime import (datetime,
                      timedelta)
from typing import (List,
                    Tuple)

import simplejson
from django.core.management.base import BaseCommand

from treeherder.perf.alerts import IdentifyLatestRetriggerables
from treeherder.perf.models import PerformanceFramework


class Command(BaseCommand):
    repos_to_retrigger_on = ['autoland', 'mozilla-inbound', 'mozilla-beta']
    help = "Select most relevant alerts and identify jobs to retrigger."

    def add_arguments(self, parser):
        parser.add_argument(
            '--time-window',
            action='store',
            type=int,
            default=60,
            help="How far back to look for alerts to retrigger (expressed in minutes)."
        )

        parser.add_argument(
            '--frameworks',
            nargs='+',
            default=None,
            help="Defaults to all registered performance frameworks."
        )

        parser.add_argument(
            '--repositories',
            nargs='+',
            default=Command.repos_to_retrigger_on,
            help=f"Defaults to {Command.repos_to_retrigger_on}."
        )

    def handle(self, *args, **options):
        frameworks, repositories, since, days_to_lookup = self._parse_args(**options)
        self._validate_args(frameworks, repositories)
        latest_retriggerables = IdentifyLatestRetriggerables(since, days_to_lookup)(frameworks, repositories)
        return simplejson.dumps(latest_retriggerables, default=str)

    def _parse_args(self, **options) -> Tuple[List, List, datetime, timedelta]:
        return (options['frameworks'],
                options['repositories'],
                datetime.now() - timedelta(minutes=options['time_window']),
                timedelta(days=1))

    def _validate_args(self, frameworks: List[str], repositories: List[str]):
        if frameworks:
            available_frameworks = set(PerformanceFramework.objects.
                                       values_list('name', flat=True))
            if not set(frameworks).issubset(available_frameworks):
                raise ArgumentError('Unknown framework provided.')
        if repositories:
            if not set(repositories).issubset(set(Command.repos_to_retrigger_on)):
                raise ArgumentError('Unknown repository provided.')
