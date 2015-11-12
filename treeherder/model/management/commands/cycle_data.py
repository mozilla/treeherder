import datetime
from optparse import make_option

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
            '--days',
            action='store',
            dest='days',
            default=settings.DATA_CYCLE_DAYS,
            type='int',
            help='Data cycle interval expressed in days'),

        make_option(
            '--chunk-size',
            action='store',
            dest='chunk_size',
            default=5000,
            type='int',
            help=('Define the size of the chunks '
                  'Split the job deletes into chunks of this size [default: %default]')),

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

        cycle_interval = datetime.timedelta(days=options['days'])

        self.debug("cycle interval... {}".format(cycle_interval))

        projects = Datasource.objects.values_list('project', flat=True)
        for project in projects:
            self.debug("Cycling Database: {0}".format(project))
            with JobsModel(project) as jm:
                rs_deleted = jm.cycle_data(cycle_interval,
                                           options['chunk_size'],
                                           options['sleep_time'])
                self.debug("Deleted {} jobs from {}".format(rs_deleted, project))

    def debug(self, msg):
        if self.is_debug:
            self.stdout.write(msg)
