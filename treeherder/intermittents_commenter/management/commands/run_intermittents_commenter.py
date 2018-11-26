import calendar
from datetime import date

from django.core.management.base import BaseCommand

from treeherder.intermittents_commenter.commenter import Commenter


class Command(BaseCommand):
    """Management command to manually initiate intermittent failures commenter
       default is daily and non-test mode, use flags for weekly, auto and test mode."""

    def add_arguments(self, parser):
        parser.add_argument('-m', '--mode', dest='weekly_mode', nargs='?', choices=['weekly', 'auto'], default=False, help='generate comment summaries based on auto or weekly mode')
        parser.add_argument('--dry-run', action='store_true', dest='dry_run', help='output comments to stdout rather than submitting to Bugzilla')

    def handle(self, *args, **options):
        mode = options['weekly_mode']
        weekly_mode = mode

        if mode == 'weekly':
            weekly_mode = True
        elif mode == 'auto':
            weekly_mode = calendar.day_name[date.today().weekday()] == 'Monday'

        process = Commenter(weekly_mode=weekly_mode, dry_run=options['dry_run'])
        process.run()
