import datetime
import logging

from abc import ABC, abstractmethod

from django.core.management.base import BaseCommand
from django.db.utils import OperationalError

from treeherder.model.models import Job, JobGroup, JobType, Machine, Repository
from treeherder.perf.exceptions import MaxRuntimeExceeded
from treeherder.perf.models import PerformanceDatum

logging.basicConfig(format='%(levelname)s:%(message)s')

TREEHERDER = 'treeherder'
PERFHERDER = 'perfherder'
TREEHERDER_SUBCOMMAND = 'from:treeherder'
PERFHERDER_SUBCOMMAND = 'from:perfherder'
MINIMUM_PERFHERDER_EXPIRE_INTERVAL = 365

logger = logging.getLogger(__name__)


class DataCycler(ABC):
    source = ''

    def __init__(self, chunk_size, sleep_time, is_debug=None, logger=None, **kwargs):
        self.chunk_size = chunk_size
        self.sleep_time = sleep_time
        self.is_debug = is_debug or False
        self.logger = logger

    @abstractmethod
    def cycle(self):
        pass


class TreeherderCycler(DataCycler):
    DEFAULT_CYCLE_INTERVAL = 120  # in days

    def __init__(self, days, chunk_size, sleep_time, is_debug=None, logger=None, **kwargs):
        super().__init__(chunk_size, sleep_time, is_debug, logger, **kwargs)
        self.days = days or self.DEFAULT_CYCLE_INTERVAL
        self.cycle_interval = datetime.timedelta(days=self.days)

    def cycle(self):
        self.logger.warning(
            f"Cycling {TREEHERDER.title()} data older than {self.days} days...\n"
            f"Cycling jobs across all repositories"
        )

        try:
            rs_deleted = Job.objects.cycle_data(
                self.cycle_interval, self.chunk_size, self.sleep_time
            )
            self.logger.warning("Deleted {} jobs".format(rs_deleted))
        except OperationalError as e:
            self.logger.error("Error running cycle_data: {}".format(e))

        self.remove_leftovers()

    def remove_leftovers(self):
        self.logger.warning('Pruning ancillary data: job types, groups and machines')

        def prune(id_name, model):
            self.logger.warning('Pruning {}s'.format(model.__name__))
            used_ids = Job.objects.only(id_name).values_list(id_name, flat=True).distinct()
            unused_ids = model.objects.exclude(id__in=used_ids).values_list('id', flat=True)

            self.logger.warning(
                'Removing {} records from {}'.format(len(unused_ids), model.__name__)
            )

            while len(unused_ids):
                delete_ids = unused_ids[: self.chunk_size]
                self.logger.warning('deleting {} of {}'.format(len(delete_ids), len(unused_ids)))
                model.objects.filter(id__in=delete_ids).delete()
                unused_ids = unused_ids[self.chunk_size :]

        prune('job_type_id', JobType)
        prune('job_group_id', JobGroup)
        prune('machine_id', Machine)


class PerfherderCycler(DataCycler):
    max_runtime = datetime.timedelta(hours=23)

    def __init__(self, chunk_size, sleep_time, is_debug=None, logger=None, **kwargs):
        super().__init__(chunk_size, sleep_time, is_debug, logger)

    def cycle(self):
        self.logger.warning(f"Cycling {PERFHERDER.title()} data...")
        started_at = datetime.datetime.now()

        removal_strategies = [
            MainRemovalStrategy(self.chunk_size),
            TryDataRemoval(self.chunk_size),
        ]

        try:
            PerformanceDatum.objects.cycle_data(
                removal_strategies, self.logger, started_at, self.max_runtime
            )
        except MaxRuntimeExceeded as ex:
            logger.warning(ex)


class MainRemovalStrategy:
    """
    Removes `performance_datum` rows
    that are at least 1 year old.
    """

    # WARNING!! Don't override this without proper approval!
    CYCLE_INTERVAL = 365  # in days                        #
    ########################################################

    def __init__(self, chunk_size: int):
        self._cycle_interval = datetime.timedelta(days=self.CYCLE_INTERVAL)
        self._chunk_size = chunk_size
        self._max_timestamp = datetime.datetime.now() - self._cycle_interval
        self._manager = PerformanceDatum.objects

    def remove(self, using):
        """
        @type using: database connection cursor
        """
        chunk_size = self._find_ideal_chunk_size()
        using.execute(
            '''
            DELETE FROM `performance_datum`
            WHERE push_timestamp < %s
            LIMIT %s
        ''',
            [self._max_timestamp, chunk_size],
        )

    def _find_ideal_chunk_size(self) -> int:
        max_id = self._manager.filter(push_timestamp__gt=self._max_timestamp).order_by('-id')[0].id
        older_ids = self._manager.filter(
            push_timestamp__lte=self._max_timestamp, id__lte=max_id
        ).order_by('id')[: self._chunk_size]

        return len(older_ids) or self._chunk_size


class TryDataRemoval:
    """
    Removes `performance_datum` rows
    that originate from `try` repository and
    that are more than 6 weeks old.
    """

    def __init__(self, chunk_size: int):
        self._cycle_interval = datetime.timedelta(weeks=4)
        self._chunk_size = chunk_size
        self._max_timestamp = datetime.datetime.now() - self._cycle_interval
        self._manager = PerformanceDatum.objects

        self.__try_repo_id = None

    @property
    def try_repo(self):
        if self.__try_repo_id is None:
            self.__try_repo_id = Repository.objects.get(name='try').id
        return self.__try_repo_id

    def remove(self, using):
        """
        @type using: database connection cursor
        """
        chunk_size = self._find_ideal_chunk_size()
        using.execute(
            '''
            DELETE FROM `performance_datum`
            WHERE repository_id = %s AND push_timestamp < %s
            LIMIT %s
        ''',
            [self.try_repo, self._max_timestamp, chunk_size],
        )

    def _find_ideal_chunk_size(self) -> int:
        max_id = (
            self._manager.filter(
                push_timestamp__gt=self._max_timestamp, repository_id=self.try_repo
            )
            .order_by('-id')[0]
            .id
        )
        older_ids = self._manager.filter(
            push_timestamp__lte=self._max_timestamp, id__lte=max_id, repository_id=self.try_repo
        ).order_by('id')[: self._chunk_size]

        return len(older_ids) or self._chunk_size


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
            help='Write debug messages to stdout',
        )
        parser.add_argument(
            '--chunk-size',
            action='store',
            dest='chunk_size',
            default=100,
            type=int,
            help=(
                'Define the size of the chunks ' 'Split the job deletes into chunks of this size'
            ),
        )
        parser.add_argument(
            '--sleep-time',
            action='store',
            dest='sleep_time',
            default=0,
            type=int,
            help='How many seconds to pause between each query. Ignored when cycling performance data.',
        )
        subparsers = parser.add_subparsers(
            description='Data producers from which to expire data', dest='data_source'
        )
        treeherder_subcommand = subparsers.add_parser(
            TREEHERDER_SUBCOMMAND
        )  # default subcommand even if not provided
        treeherder_subcommand.add_argument(
            '--days',
            action='store',
            dest='days',
            type=int,
            help='Data cycle interval expressed in days. '
            'Only relevant for Treeherder specific data.',
        )

        # Perfherder will have its own specifics
        subparsers.add_parser(PERFHERDER_SUBCOMMAND)

    def handle(self, *args, **options):
        data_cycler = self.fabricate_data_cycler(options, logger)
        data_cycler.cycle()

    def fabricate_data_cycler(self, options, logger):
        data_source = options.pop('data_source') or TREEHERDER_SUBCOMMAND
        data_source = data_source.split(':')[1]

        cls = self.CYCLER_CLASSES[data_source]
        return cls(logger=logger, **options)
