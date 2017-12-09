import datetime
import time

from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.model.models import (FailureLine,
                                     Job,
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
            '--target',
            action='store',
            dest='target',
            default="all",
            help='What to cycle: jobs, refdata, logdata.  Default: all'
        )
        parser.add_argument(
            '--days',
            action='store',
            dest='days',
            default=settings.DATA_CYCLE_DAYS,
            type=int,
            help='Data cycle interval expressed in days'
        )
        parser.add_argument(
            '--chunk-size',
            action='store',
            dest='chunk_size',
            default=settings.DATA_CYCLE_CHUNK_SIZE,
            type=int,
            help=('Define the size of the chunks '
                  'Split the job deletes into chunks of this size')
        )
        parser.add_argument(
            '--sleep-time',
            action='store',
            dest='sleep_time',
            default=settings.DATA_CYCLE_SLEEP_TIME,
            type=int,
            help='How many seconds to pause between each query'
        )
        parser.add_argument(
            '--iterations',
            action='store',
            dest='iterations',
            default=settings.DATA_CYCLE_ITERATIONS,
            type=int,
            help='How many times to loop some processes'
        )

    def handle(self, *args, **options):
        self.is_debug = options['debug']

        cycle_interval = datetime.timedelta(days=options['days'])

        self.debug("cycle interval... {}".format(cycle_interval))

        if options['target'] in ["all", "jobs"]:
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

        if options['target'] in ["all", "logdata"]:
            self.cycle_expired_log_records(
                options['chunk_size'],
                options['sleep_time'],
                options['iterations'],
                cycle_interval)

        if options['target'] in ["all", "refdata"]:
            self.cycle_non_job_data(
                options['chunk_size'],
                options['sleep_time'],
                cycle_interval)

    def cycle_expired_log_records(self, chunk_size, sleep_time, iterations, cycle_interval):
        self.debug("delete expired FailureLines")
        for x in range(0, iterations):
            old_fline_ids = list(FailureLine.objects.filter(
                created__lt=datetime.date.today() - cycle_interval
                ).order_by('id')[:chunk_size].values_list('id', flat=True))
            self.debug("Run {}: {} FailureLine records to be deleted".format(
                x, len(old_fline_ids)))

            if len(old_fline_ids) == 0:
                # if there are no records to delete, no sense in finishing the
                # iterations
                break

            FailureLine.objects.filter(id__in=old_fline_ids).delete()
            self.debug("FailureLines deleted, sleeping for {}".format(sleep_time))
            time.sleep(sleep_time)

    def cycle_non_job_data(self, chunk_size, sleep_time, cycle_interval):
        self.debug("delete unused JobType records")
        used_job_type_ids = Job.objects.values('job_type_id').distinct()
        JobType.objects.exclude(id__in=used_job_type_ids).delete()

        self.debug("delete unused JobGroup records")
        used_job_group_ids = Job.objects.values('job_group_id').distinct()
        JobGroup.objects.exclude(id__in=used_job_group_ids).delete()

        self.debug("delete unused Machine records")
        used_machine_ids = Job.objects.values('machine_id').distinct()
        Machine.objects.exclude(id__in=used_machine_ids).delete()

    def debug(self, msg):
        if self.is_debug:
            self.stdout.write(msg)
