from django.core.management.base import BaseCommand

from treeherder.model.tasks import publish_to_pulse


class Command(BaseCommand):
    help = """Publish specified result sets to Pulse"""

    def add_arguments(self, parser):
        parser.add_argument(
            '--project',
            action='store_true',
            dest='project',
            default='mozilla-inbound',
            help='Name of the treeherder project: mozilla-inbound, mozilla-aurora etc...'
        )
        parser.add_argument(
            '--result_set_ids',
            action='store',
            dest='result_set_ids',
            default=1,
            help='Comma delimited list of result set ids to publish to pulse'
        )

    def handle(self, *args, **options):

        project = options.get("project")

        result_set_ids = map(
            lambda x: int(x or 0),
            options.get("result_set_ids", "1").split(',')
        )

        publish_to_pulse(project, result_set_ids, 'result_set')
