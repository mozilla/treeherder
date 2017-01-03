from django.core.management.base import BaseCommand

from treeherder.credentials.models import Credentials


class Command(BaseCommand):
    help = 'Create or retrieve a set of Hawk credentials for use with the API'

    def add_arguments(self, parser):
        parser.add_argument('client_id')

    def handle(self, *args, **options):
        credentials, created = Credentials.objects.get_or_create(
            client_id=options['client_id'],
            defaults={'authorized': True}
        )

        if created:
            message = 'Successfully created Hawk client ID "%s"'
        else:
            message = 'Hawk client ID "%s" already exists'

        self.stdout.write(message % credentials.client_id)
        self.stdout.write('Secret: %s' % credentials.secret)
