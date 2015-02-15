# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from optparse import make_option
from django.core.management.base import BaseCommand
from treeherder.model.tasks import process_objects


class Command(BaseCommand):
    help = """Process a number of objects with status 'ready' in the objectstore"""

    option_list = BaseCommand.option_list + (
        make_option('--limit',
                    action='store',
                    dest='limit',
                    default=None,
                    help='Limit the number of objects to process'),
    )

    def handle(self, *args, **options):
        process_objects.delay(limit=options['limit'])
