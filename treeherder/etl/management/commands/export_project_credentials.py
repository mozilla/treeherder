import os
from optparse import make_option

import simplejson as json
from django.core.management.base import BaseCommand

from treeherder.model.derived.base import TreeherderModelBase

DEFAULT_CREDENTIALS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    'data',
    'credentials.json'
)


class Command(BaseCommand):
    """Management command to export project credentials."""
    help = "Exports the Oauth keys for etl data import tasks"

    option_list = BaseCommand.option_list + (
        make_option(
            '--safe',
            action='store_true',
            default=False,
            dest='safe',
            help="Don't overwrite credentials file if it exists."
        ),
        make_option(
            '--destination',
            action='store',
            default=DEFAULT_CREDENTIALS_PATH,
            dest='destination',
            help="Don't overwrite credentials file if it exists."
        ),

    )

    def handle(self, *args, **options):
        safe = options.get('safe')
        file_path = options.get('destination')
        if file_path == 'stdout':
            write_credentials(self.stdout)
        else:
            if not os.path.isfile(file_path) or not safe:
                with open(file_path, 'w') as fh:
                    write_credentials(fh)


def write_credentials(fh):
    immutable_credentials = TreeherderModelBase.get_oauth_credentials()
    fh.write(json.dumps(immutable_credentials))
