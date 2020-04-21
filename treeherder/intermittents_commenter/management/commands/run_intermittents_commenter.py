import calendar
from datetime import date

from django.core.management.base import BaseCommand

from treeherder.intermittents_commenter.commenter import Commenter


class Command(BaseCommand):
    """Management command to manually initiate intermittent failures commenter
       default is daily and non-test mode, use flags for weekly, auto and test mode."""

    def add_arguments(self, parser):
        parser.add_argument(
            '-m',
            '--mode',
            dest='mode',
            nargs='?',
            choices=['weekly', 'auto'],
            default=False,
            help='generate comment summaries based on auto or weekly mode; defaults to daily',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            dest='dry_run',
            help='output comments to stdout rather than submitting to Bugzilla',
        )

    def handle(self, *args, **options):
        mode = options['mode']
        is_monday = calendar.day_name[date.today().weekday()] == 'Monday'
        weekly_mode = (mode == 'weekly') or (mode == 'auto' and is_monday)

        process = Commenter(weekly_mode=weekly_mode, dry_run=options['dry_run'])
        process.run()
