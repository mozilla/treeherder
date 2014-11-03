# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from optparse import make_option
from django.core.management.base import BaseCommand
from treeherder.model.models import Repository
from treeherder.model.derived import JobsModel
from treeherder.model.tasks import cycle_data

class Command(BaseCommand):
    help = """Cycle data that exceeds the time constraint limit"""

    option_list = BaseCommand.option_list + (

        make_option('--debug',
            action='store_true',
            dest='debug',
            default=None,
            help='Write debug messages to stdout'),

        make_option('--iterations',
            action='store',
            dest='iterations',
            default=5,
            help='Number of data cycle iterations to execute in a single run'),
    )

    def handle(self, *args, **options):

        debug = options.get("debug", None)
        max_iterations = int(options.get("iterations"))

        cycle_data(max_iterations, debug)
