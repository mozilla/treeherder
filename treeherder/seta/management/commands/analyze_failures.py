from django.core.management.base import BaseCommand

from treeherder.seta.analyze_failures import AnalyzeFailures


class Command(BaseCommand):
    help = 'Analyze jobs that failed and got tagged with fixed_by_commit ' \
           'and change the priority and timeout of such job.'

    def __init__(self, *args, **kwargs):
        super(Command, self).__init__(*args, **kwargs)

    def add_arguments(self, parser):
        parser.add_argument("-s", "--start-date", metavar="YYYY-MM-DD", dest="start_date",
                            help="Start date for analysis.")

        parser.add_argument("-e", "--end-date", metavar="YYYY-MM-DD", dest="end_date",
                            help="End date for analysis.")

        parser.add_argument("--dry-run", action="store_true", dest="dry_run",
                            help="This mode is for testing without interaction with "
                            "database and emails.")

        parser.add_argument("--ignore-failures", type=int, dest="ignore_failures", default=0,
                            help="If a job fails less than N times we don't take that job"
                                 "into account.")

    def handle(self, *args, **options):
        AnalyzeFailures(**options).run()
