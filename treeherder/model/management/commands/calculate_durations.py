from django.core.management.base import BaseCommand

from treeherder.model.tasks import calculate_durations


class Command(BaseCommand):
    help = """Populate the job_duration table with average durations for recent jobs"""

    def add_arguments(self, parser):
        parser.add_argument(
            '--debug',
            action='store_true',
            dest='debug',
            default=None,
            help='Write debug messages to stdout'
        )
        parser.add_argument(
            '--sample_window_size',
            action='store',
            dest='sample_window_size',
            default=12,
            help='Number of hours to include in the sample window, defaults to 12'
        )

    def handle(self, *args, **options):

        debug = options.get("debug", None)
        sample_window_size = int(options.get("sample_window_size"))

        sample_window_seconds = 60 * 60 * sample_window_size

        calculate_durations(sample_window_seconds, debug)
