from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from treeherder.credentials.models import Credentials


class Command(BaseCommand):
    help = 'Create a new set of credentials to use with the hawk authentication scheme'

    def add_arguments(self, parser):
        parser.add_argument('client_id', type=str)
        parser.add_argument('owner', type=str)
        parser.add_argument('description', type=str)

    def handle(self, *args, **options):
        owner = User.objects.get(email=options['owner'])
        credentials = Credentials.objects.create(
            client_id=options['client_id'],
            description=options['description'],
            owner=owner,
            authorized=True
        )

        self.stdout.write('Successfully created credentials for "%s"' % credentials.client_id)
        self.stdout.write('Secret: %s' % credentials.secret)
