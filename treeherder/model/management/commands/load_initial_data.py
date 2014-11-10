# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.management.base import BaseCommand
from django.core.management import call_command
from treeherder.model.models import Datasource, Repository

class Command(BaseCommand):
    help = "Load initial data into the master db"

    def handle(self, *args, **options):
        call_command('loaddata',
                     'repository_group',
                     'repository',
                     'failure_classification')
