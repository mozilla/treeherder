from django.core.management.base import BaseCommand

from treeherder.credentials.models import Credentials


class Command(BaseCommand):
    help = 'Create a new set of credentials to use with the hawk authentication scheme'

    def add_arguments(self, parser):
        parser.add_argument('client_id', type=str)

    def handle(self, *args, **options):
        credentials = Credentials.objects.create(
            client_id=options['client_id'],
            authorized=True
        )

        self.stdout.write('Successfully created credentials for "%s"' % credentials.client_id)
        self.stdout.write('Secret: %s' % credentials.secret)
