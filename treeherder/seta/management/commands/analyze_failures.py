from django.core.management.base import BaseCommand

from treeherder.seta.analyze_failures import AnalyzeFailures


class Command(BaseCommand):
    help = 'Analyze jobs that failed and got tagged with fixed_by_commit ' \
           'and change the priority and timeout of such job.'

    def __init__(self, *args, **kwargs):
        super(Command, self).__init__(*args, **kwargs)

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", dest="dry_run",
                            help="This mode is for analyzing failures without "
                                 "updating the job priority table.")

        parser.add_argument("--ignore-failures", type=int, dest="ignore_failures", default=0,
                            help="If a job fails less than N times we don't take that job"
                                 "into account.")

    def handle(self, *args, **options):
        AnalyzeFailures(**options).run()
