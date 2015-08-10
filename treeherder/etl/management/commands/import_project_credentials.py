import os

import simplejson as json
from django.core.management.base import BaseCommand, CommandError

from treeherder.model.models import Datasource


class Command(BaseCommand):

    """Management command to import project credentials."""

    help = "Import the Oauth keys for etl data import tasks"
    args = "<credentials_file>"

    def handle(self, *args, **options):

        if not (os.path.exists(args[0]) and os.path.isfile(args[0])):
            raise CommandError("Credentials file not found: %s" % args[0])
        with open(args[0]) as credentials_file:
            credentials = json.loads(credentials_file.read())
            ds_list = Datasource.objects.filter(project__in=credentials.keys())
            datasource_dict = dict((ds.project, ds) for ds in ds_list)
            for project, cred in credentials.items():
                if project in datasource_dict:
                    datasource_dict[project].oauth_consumer_key = cred['consumer_key']
                    datasource_dict[project].oauth_consumer_secret = cred['consumer_secret']
                    datasource_dict[project].save()
        self.stdout.write("Credentials loaded successfully")
