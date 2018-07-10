from django.core.management.base import BaseCommand

from treeherder.intermittents_commenter.commenter import Commenter


class Command(BaseCommand):
    """Management command to manually initiate intermittent failures commenter
        default is daily and non-test mode, use flags for weekly and test mode."""

    def add_arguments(self, parser):
        parser.add_argument('-w', '--weekly', action='store_true', dest='weekly_mode', help='generate weekly, rather than daily, comment summaries')
        parser.add_argument('--dry-run', action='store_true', dest='dry_run', help='output comments to stdout rather than submitting to Bugzilla')

    def handle(self, *args, **options):
        process = Commenter(**options)
        process.run()
