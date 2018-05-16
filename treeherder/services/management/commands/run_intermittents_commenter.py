from django.core.management.base import BaseCommand

from treeherder.services.intermittents_commenter.commenter import Commenter


class Command(BaseCommand):
    """Management command to manually initiate intermittent failures commenter
        default is daily and non-test mode, use flags for weekly and test mode'"""

    def add_arguments(self, parser):
        parser.add_argument('-w', '--weekly', action='store_true', help='generates weekly, rather than daily, comment summaries')
        parser.add_argument('-t', '--test', action='store_true', help='output comments to stdout rather than submitting to Bugzilla')

    def handle(self, *args, **options):
        weekly_mode = False
        test_mode = False

        if options['weekly']:
            weekly_mode = True

        if options['test']:
            test_mode = True

        process = Commenter(weekly_mode, test_mode)
        process.run()
