import datetime
import logging

from django.core.management.base import BaseCommand

from treeherder.model.models import (Job,
                                     JobGroup,
                                     JobType,
                                     Machine,
                                     Repository)
from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceDatumManager)

logging.basicConfig(format='%(levelname)s:%(message)s')

TREEHERDER = 'treeherder'
PERFHERDER = 'perfherder'
DATA_PRODUCERS = [TREEHERDER, PERFHERDER]


class DataCycler:
    source = ''

    def __init__(self, days, chunk_size, sleep_time, is_debug=None,
                 logger=None, **kwargs):
        self.cycle_interval = datetime.timedelta(days=days)
        self.chunk_size = chunk_size
        self.sleep_time = sleep_time
        self.is_debug = is_debug or False
        self.logger = logger

    def cycle(self, repository):
        pass


class TreeherderCycler(DataCycler):
    source = TREEHERDER.title()

    def cycle(self):
        for repository in Repository.objects.all():
            self.logger.debug("Cycling repository: {0}".format(repository.name))
            rs_deleted = Job.objects.cycle_data(repository,
                                                self.cycle_interval,
                                                self.chunk_size,
                                                self.sleep_time)
            self.logger.debug("Deleted {} jobs from {}".format(rs_deleted,
                                                               repository.name))

        self.remove_leftovers()

    def remove_leftovers(self):
        def extract_id_groups(id_names, used_dependencies):
            id_groups = {id_name: set() for id_name in id_names}

            for dependency in used_dependencies:
                for id_name in id_names:
                    id_groups[id_name].add(dependency[id_name])
            return [id_groups[name] for name in id_names]

        used_dependencies = (Job.objects
                                .values('job_type_id', 'job_group_id', 'machine_id')
                                .distinct())

        (used_job_type_ids,
         used_job_group_ids,
         used_machine_ids) = extract_id_groups(
            ['job_type_id',
             'job_group_id',
             'machine_id'],
            used_dependencies)

        JobType.objects.exclude(id__in=used_job_type_ids).delete()
        JobGroup.objects.exclude(id__in=used_job_group_ids).delete()
        Machine.objects.exclude(id__in=used_machine_ids).delete()


class PerfherderCycler(DataCycler):
    source = PERFHERDER.title()

    def __init__(self, days, chunk_size, sleep_time, is_debug=None,
                 logger=None, **kwargs):
        super().__init__(days, chunk_size, sleep_time, is_debug, logger)
        self.unsheriffed_repos_expire_days = datetime.timedelta(days=kwargs['days_for_nonmain'])
        self.keep_old_frameworks = kwargs['keep_old_frameworks']

    def cycle(self):
        for repository in Repository.objects.all():
            self.logger.debug('Cycling repository: {0}'.format(repository.name))
            PerformanceDatum.objects.cycle_data(repository,
                                                self.cycle_interval,
                                                self.chunk_size,
                                                self.sleep_time,
                                                self.unsheriffed_repos_expire_days,
                                                self.keep_old_frameworks)


class Logger:
    def __init__(self, enable):
        self.enable = enable

    def debug(self, msg):
        if self.enable:
            logging.warning(msg)


class Command(BaseCommand):
    help = """Cycle data that exceeds the time constraint limit"""
    CYCLER_CLASSES = {
        TREEHERDER: TreeherderCycler,
        PERFHERDER: PerfherderCycler,
    }

    def add_arguments(self, parser):
        parser.add_argument(
            '--debug',
            action='store_true',
            dest='is_debug',
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
        subparsers = parser.add_subparsers(
            description='Data producers from which to expire data',
            required=True,
            dest='data_source')
        subparsers.add_parser('from:treeherder')

        # Perfherder has its own specifics
        perfherder_subcom = subparsers.add_parser('from:perfherder')
        perfherder_subcom.add_argument(
            '--days-for-nonmain',
            default=42,
            type=int,
            help='Expire time for repositories other than {}. This is a secondary data cycle interval.'.format(
                ', '.join(PerformanceDatumManager.MAIN_REPOS))
        )
        perfherder_subcom.add_argument(
            '-k', '--keep-old-frameworks',
            action='store_true',
            help="[COMPLETELY DISABLED EITHER WAY] Don't expire performance data from old frameworks"
        )

    def handle(self, *args, **options):
        logger = Logger(options.pop('is_debug'))

        logger.debug("Cycle interval... {}".format(options['days']))

        data_cycler = self.fabricate_data_cycler(options, logger)
        logger.debug('Cycling {0} data...'.format(data_cycler.source))
        data_cycler.cycle()

    def fabricate_data_cycler(self, options, logger):
        data_source = options.pop('data_source')
        data_source = data_source.split(':')[1]

        cls = self.CYCLER_CLASSES[data_source]
        return cls(logger=logger, **options)
