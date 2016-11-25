import datetime
from optparse import make_option

import MySQLdb
from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.model.derived import JobsModel
from treeherder.model.models import (Datasource,
                                     JobGroup,
                                     JobType,
                                     Machine)


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

        self.cycle_non_job_data(options['chunk_size'], options['sleep_time'])

    def cycle_non_job_data(self, chunk_size, sleep_time):
        (used_job_type_ids, used_machine_ids) = (set(), set())
        for d in Datasource.objects.all():
            db_options = settings.DATABASES['default'].get('OPTIONS', {})
            db = MySQLdb.connect(
                host=settings.DATABASES['default']['HOST'],
                db=d.name,
                user=settings.DATABASES['default']['USER'],
                passwd=settings.DATABASES['default'].get('PASSWORD') or '',
                **db_options
            )
            c = db.cursor()
            c.execute("""select distinct job_type_id from job""")
            used_job_type_ids.update(set([job_id[0] for job_id in c.fetchall()]))
            c.execute("""select distinct machine_id from job""")
            used_machine_ids.update(set([machine_id[0] for machine_id in c.fetchall()]))

        JobType.objects.exclude(id__in=used_job_type_ids).delete()

        used_job_group_ids = set(JobType.objects.values_list('job_group', flat=True))
        JobGroup.objects.exclude(id__in=used_job_group_ids).delete()

        Machine.objects.exclude(id__in=used_machine_ids).delete()

    def debug(self, msg):
        if self.is_debug:
            self.stdout.write(msg)
