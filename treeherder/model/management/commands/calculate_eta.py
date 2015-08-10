from optparse import make_option

from django.core.management.base import BaseCommand

from treeherder.model.tasks import calculate_eta


class Command(BaseCommand):
    help = """Cycle data that exceeds the time constraint limit"""

    option_list = BaseCommand.option_list + (

        make_option('--debug',
                    action='store_true',
                    dest='debug',
                    default=None,
                    help='Write debug messages to stdout'),

        make_option('--sample_window_size',
                    action='store',
                    dest='sample_window_size',
                    default=12,
                    help='Number of hours to include in the sample window, defaults to 12'),
    )

    def handle(self, *args, **options):

        debug = options.get("debug", None)
        sample_window_size = int(options.get("sample_window_size"))

        sample_window_seconds = 60 * 60 * sample_window_size

        calculate_eta(sample_window_seconds, debug)
