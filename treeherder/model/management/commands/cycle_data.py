import datetime
from optparse import make_option
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.model.derived import JobsModel
from treeherder.model.models import Datasource


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
            '--resultset-data-cycle-interval',
            action='store',
            dest='resultset_data_cycle_interval',
            default=0,
            type='int',
            help='Reultsetdata cycle interval expressed in days'),

        make_option(
            '--revision-data-cycle-interval',
            action='store',
            dest='revision_data_cycle_interval',
            default=0,
            type='int',
            help='Revision data cycle interval expressed in days'),

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

        cycle_interval = {}
        if options['revision_data_cycle_interval']:
            cycle_interval["revisiondata"] = timedelta(days=options['revision_data_cycle_interval'])
        else:
            cycle_interval["revisiondata"] = settings.DATA_CYCLE_INTERVAL["revisiondata"]
        if options['resultset_data_cycle_interval']:
            cycle_interval["resultset"] = timedelta(days=options['resultset_data_cycle_interval'])
        else:
            cycle_interval["resultset"] = settings.DATA_CYCLE_INTERVAL["resultset"]

        self.debug("cycle interval... jobs: {}".format(cycle_interval))

        projects = Datasource.objects.values_list('project', flat=True)
        for project in projects:
            self.debug("Cycling Database: {0}".format(project))
            with JobsModel(project) as jm:
                rs_deleted = jm.cycle_data(cycle_interval,
                                           options['chunk_size'],
                                           options['sleep_time'])
                self.debug("Deleted {} resultsets from {}".format(rs_deleted, project))

    def debug(self, msg):
        if self.is_debug:
            self.stdout.write(msg)
