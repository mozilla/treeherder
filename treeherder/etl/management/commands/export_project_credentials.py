# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import os
import json

from optparse import make_option
from django.core.management.base import BaseCommand

from treeherder.model.models import Datasource
from treeherder.model.derived.base import TreeherderModelBase
from treeherder.etl import buildapi


class Command(BaseCommand):
    """Management command to export project credentials."""

    help = "Exports the objectstore Oauth keys for etl data import tasks"

    option_list = BaseCommand.option_list + (

        make_option(
            '--safe',
            action='store_true',
            default=False,
            dest='safe',
            help="Don't overwrite credentials file if it exists."
            ),
        )

    def handle(self, *args, **options):

        safe = options.get("safe")

        file_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'data',
            'credentials.json'
            )

        if not os.path.isfile(file_path):

            # If it doesn't exist create it
            write_credentials(file_path)

        else:
            # File already exists, if safe is specified don't do anything
            if not safe:
                write_credentials(file_path)

def write_credentials(file_path):

    immutable_credentials = TreeherderModelBase.get_oauth_credentials()
    keys_fh = open(file_path, 'w')
    keys_fh.write(json.dumps(immutable_credentials))
    keys_fh.close()



