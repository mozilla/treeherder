# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from optparse import make_option
import datetime
from django.core.management.base import BaseCommand
from treeherder.model.derived import JobsModel
from treeherder.model.models import Datasource
from django.conf import settings


class Command(BaseCommand):
    help = """Cycle data that exceeds the time constraint limit"""

    option_list = BaseCommand.option_list + (

        make_option(
            '--debug',
            action='store_true',
            dest='debug',
            default=False,
            help='Write debug messages to stdout'),

        make_option(
            '--cycle-interval',
            action='store',
            dest='cycle_interval',
            default=0,
            type='int',
            help='Data cycle interval expressed in days'),

        make_option(
            '--chunk-size',
            action='store',
            dest='chunk_size',
            default=10,
            type='int',
            help=('Define the size of the chunks '
                  'the target data will be divided in')),

        make_option(
            '--sleep-time',
            action='store',
            dest='sleep_time',
            default=2,
            type='int',
            help='How many seconds to pause between each query'),
    )

    def handle(self, *args, **options):
        self.is_debug = options['debug']

        if options['cycle_interval']:
            cycle_interval = datetime.timedelta(days=options['cycle_interval'])
        else:
            cycle_interval = settings.DATA_CYCLE_INTERVAL

        self.debug("cycle interval... jobs: {}".format(cycle_interval))

        projects = Datasource.objects\
            .filter(contenttype='jobs')\
            .values_list('project', flat=True)
        for project in projects:
            self.debug("Cycling Database: {0}".format(project))
            with JobsModel(project) as jm:
                rs_deleted = jm.cycle_data(cycle_interval,
                                           options['chunk_size'],
                                           options['sleep_time'])
                self.debug("Deleted {} resultsets from {}".format(
                           rs_deleted, project))

    def debug(self, msg):
        if self.is_debug:
            self.stdout.write(msg)
