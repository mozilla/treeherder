import os
import json

from django.core.management.base import BaseCommand

from treeherder.model.models import Datasource
from treeherder.model.derived.base import TreeherderModelBase
from treeherder.etl import buildapi


class Command(BaseCommand):
    """Management command to run mozilla pulse consumer."""

    help = (
        "Exports the objectstore Oauth keys for etl data import tasks"
    )

    def handle(self, *args, **options):

        immutable_credentials = TreeherderModelBase.get_oauth_credentials()

        print immutable_credentials
        """
        ds_list = Datasource.objects.all()

        keys = {}
        for ds in ds_list:
            if (ds.contenttype == 'objectstore') and (ds.oauth_consumer_key):
                keys[ds.project] = ds.oauth_consumer_key

        json_keys = json.dumps(keys)

        file_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'data',
            'keys.json'
            )

        keys_fh = open(file_path, 'w')
        keys_fh.write(json_keys)
        keys_fh.close()
        """
