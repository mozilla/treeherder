from optparse import make_option

from django.core.management.base import BaseCommand

from treeherder.perf.autoclassify import classify


class Command(BaseCommand):

    p = """
    Automatically classify Alerts as downstream to another AlertSummary
    """
    option_list = BaseCommand.option_list + (
        make_option('--count',
                    action='store',
                    default=100,
                    help='Number of the latest AlertSummaries to classify'
                    ),
    )

    def handle(self, *args, **options):
        classify(options['count'])
