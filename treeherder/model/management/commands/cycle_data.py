import datetime

from django.core.management.base import BaseCommand

from treeherder.model.models import (Job,
                                     JobGroup,
                                     JobType,
                                     Machine,
                                     Repository)
from treeherder.perf.models import PerformanceDatum


class Command(BaseCommand):
    help = """Cycle data that exceeds the time constraint limit"""

    def add_arguments(self, parser):
        parser.add_argument(
            '--debug',
            action='store_true',
            dest='debug',
            default=False,
            help='Write debug messages to stdout'
        )
        parser.add_argument(
            '--days',
            action='store',
            dest='days',
            default=120,
            type=int,
            help='Data cycle interval expressed in days'
        )
        parser.add_argument(
            '--chunk-size',
            action='store',
            dest='chunk_size',
            default=100,
            type=int,
            help=('Define the size of the chunks '
                  'Split the job deletes into chunks of this size')
        )
        parser.add_argument(
            '--sleep-time',
            action='store',
            dest='sleep_time',
            default=0,
            type=int,
            help='How many seconds to pause between each query'
        )

    def handle(self, *args, **options):
        self.is_debug = options['debug']

        cycle_interval = datetime.timedelta(days=options['days'])

        self.debug("cycle interval... {}".format(cycle_interval))

        for repository in Repository.objects.all():
            self.debug("Cycling repository: {0}".format(repository.name))
            rs_deleted = Job.objects.cycle_data(repository,
                                                cycle_interval,
                                                options['chunk_size'],
                                                options['sleep_time'])
            self.debug("Deleted {} jobs from {}".format(rs_deleted,
                                                        repository.name))

            # TODO: Fix the performance issues and re-enable:
            # https://bugzilla.mozilla.org/show_bug.cgi?id=1346567#c10
            if False and repository.expire_performance_data:
                PerformanceDatum.objects.cycle_data(repository,
                                                    cycle_interval,
                                                    options['chunk_size'],
                                                    options['sleep_time'])

        self.cycle_non_job_data(options['chunk_size'], options['sleep_time'])

    def cycle_non_job_data(self, chunk_size, sleep_time):
        used_job_type_ids = Job.objects.values('job_type_id').distinct()
        JobType.objects.exclude(id__in=used_job_type_ids).delete()

        used_job_group_ids = Job.objects.values('job_group_id').distinct()
        JobGroup.objects.exclude(id__in=used_job_group_ids).delete()

        used_machine_ids = Job.objects.values('machine_id').distinct()
        Machine.objects.exclude(id__in=used_machine_ids).delete()

    def debug(self, msg):
        if self.is_debug:
            self.stdout.write(msg)
