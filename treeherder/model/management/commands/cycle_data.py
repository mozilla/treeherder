from __future__ import annotations
import logging
from datetime import datetime, timedelta

from abc import ABC, abstractmethod

from django.core.management.base import BaseCommand
from django.db import connection
from django.db.backends.utils import CursorWrapper
from django.db.utils import OperationalError
from typing import List

from treeherder.model.models import Job, JobGroup, JobType, Machine, Repository
from treeherder.perf.exceptions import MaxRuntimeExceeded, NoDataCyclingAtAll
from treeherder.perf.models import PerformanceDatum, PerformanceSignature

logging.basicConfig(format='%(levelname)s:%(message)s')

TREEHERDER = 'treeherder'
PERFHERDER = 'perfherder'
TREEHERDER_SUBCOMMAND = 'from:treeherder'
PERFHERDER_SUBCOMMAND = 'from:perfherder'
MINIMUM_PERFHERDER_EXPIRE_INTERVAL = 365

logger = logging.getLogger(__name__)


class DataCycler(ABC):
    def __init__(self, chunk_size: int, sleep_time: int, is_debug: bool = None, **kwargs):
        self.chunk_size = chunk_size
        self.sleep_time = sleep_time
        self.is_debug = is_debug or False

    @abstractmethod
    def cycle(self):
        pass


class TreeherderCycler(DataCycler):
    DEFAULT_CYCLE_INTERVAL = 120  # in days

    def __init__(
        self, days: int, chunk_size: int, sleep_time: int, is_debug: bool = None, **kwargs
    ):
        super().__init__(chunk_size, sleep_time, is_debug, **kwargs)
        self.days = days or self.DEFAULT_CYCLE_INTERVAL
        self.cycle_interval = timedelta(days=self.days)

    def cycle(self):
        logger.warning(
            f"Cycling {TREEHERDER.title()} data older than {self.days} days...\n"
            f"Cycling jobs across all repositories"
        )

        try:
            rs_deleted = Job.objects.cycle_data(
                self.cycle_interval, self.chunk_size, self.sleep_time
            )
            logger.warning("Deleted {} jobs".format(rs_deleted))
        except OperationalError as e:
            logger.error("Error running cycle_data: {}".format(e))

        self.remove_leftovers()

    def remove_leftovers(self):
        logger.warning('Pruning ancillary data: job types, groups and machines')

        def prune(id_name, model):
            logger.warning('Pruning {}s'.format(model.__name__))
            used_ids = Job.objects.only(id_name).values_list(id_name, flat=True).distinct()
            unused_ids = model.objects.exclude(id__in=used_ids).values_list('id', flat=True)

            logger.warning('Removing {} records from {}'.format(len(unused_ids), model.__name__))

            while len(unused_ids):
                delete_ids = unused_ids[: self.chunk_size]
                logger.warning('deleting {} of {}'.format(len(delete_ids), len(unused_ids)))
                model.objects.filter(id__in=delete_ids).delete()
                unused_ids = unused_ids[self.chunk_size :]

        prune('job_type_id', JobType)
        prune('job_group_id', JobGroup)
        prune('machine_id', Machine)


class PerfherderCycler(DataCycler):
    DEFAULT_MAX_RUNTIME = timedelta(hours=23)

    def __init__(
        self,
        chunk_size: int,
        sleep_time: int,
        is_debug: bool = None,
        max_runtime: timedelta = None,
        strategies: List[RemovalStrategy] = None,
        **kwargs,
    ):
        super().__init__(chunk_size, sleep_time, is_debug)
        self.started_at = None
        self.max_runtime = max_runtime or PerfherderCycler.DEFAULT_MAX_RUNTIME
        self.strategies = strategies or RemovalStrategy.fabricate_all_strategies(chunk_size)

    def cycle(self):
        """
        Delete data older than cycle_interval, splitting the target data
        into chunks of chunk_size size.
        """
        logger.warning(f"Cycling {PERFHERDER.title()} data...")
        self.started_at = datetime.now()

        try:
            for strategy in self.strategies:
                try:
                    logger.warning(f'Cycling data using {strategy.name}...')
                    self._delete_in_chunks(strategy)
                except NoDataCyclingAtAll as ex:
                    logger.warning(str(ex))

            # also remove any signatures which are (no longer) associated with
            # a job
            logger.warning('Removing performance signatures with missing jobs...')
            for signature in PerformanceSignature.objects.all():
                self._quit_on_timeout()

                if not PerformanceDatum.objects.filter(
                    repository_id=signature.repository_id,  # leverages (repository, signature) compound index
                    signature_id=signature.id,
                ).exists():
                    signature.delete()
        except MaxRuntimeExceeded as ex:
            logger.warning(ex)

    def _quit_on_timeout(self):
        elapsed_runtime = datetime.now() - self.started_at

        if self.max_runtime < elapsed_runtime:
            raise MaxRuntimeExceeded('Max runtime for performance data cycling exceeded')

    def _delete_in_chunks(self, strategy: RemovalStrategy):
        any_successful_attempt = False

        with connection.cursor() as cursor:
            while True:
                self._quit_on_timeout()

                try:
                    strategy.remove(using=cursor)
                except Exception as ex:
                    self.__handle_chunk_removal_exception(ex, cursor, any_successful_attempt)
                    break
                else:
                    deleted_rows = cursor.rowcount

                    if deleted_rows == 0 or deleted_rows == -1:
                        break  # either finished removing all expired data or failed
                    else:
                        any_successful_attempt = True
                        logger.warning(
                            'Successfully deleted {} performance datum rows'.format(deleted_rows)
                        )

    def __handle_chunk_removal_exception(
        self, exception, cursor: CursorWrapper, any_successful_attempt: bool
    ):
        msg = 'Failed to delete performance data chunk'
        if hasattr(cursor, '_last_executed'):
            msg = f'{msg}, while running "{cursor._last_executed}" query'

        if any_successful_attempt:
            # an intermittent error may have occurred
            logger.warning(f'{msg}: (Exception: {exception})')
        else:
            logger.warning(msg)
            raise NoDataCyclingAtAll() from exception


class RemovalStrategy(ABC):
    @abstractmethod
    def remove(self, using: CursorWrapper):
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @staticmethod
    def fabricate_all_strategies(*args, **kwargs):
        return [
            MainRemovalStrategy(*args, **kwargs),
            TryDataRemoval(*args, **kwargs),
            # append here any new strategies
            # ...
        ]


class MainRemovalStrategy(RemovalStrategy):
    """
    Removes `performance_datum` rows
    that are at least 1 year old.
    """

    # WARNING!! Don't override this without proper approval!
    CYCLE_INTERVAL = 365  # in days                        #
    ########################################################

    def __init__(self, chunk_size: int):
        self._cycle_interval = timedelta(days=self.CYCLE_INTERVAL)
        self._chunk_size = chunk_size
        self._max_timestamp = datetime.now() - self._cycle_interval
        self._manager = PerformanceDatum.objects

    def remove(self, using: CursorWrapper):
        chunk_size = self._find_ideal_chunk_size()
        using.execute(
            '''
            DELETE FROM `performance_datum`
            WHERE push_timestamp <= %s
            LIMIT %s
        ''',
            [self._max_timestamp, chunk_size],
        )

    @property
    def name(self) -> str:
        return 'main removal strategy'

    def _find_ideal_chunk_size(self) -> int:
        max_id = self._manager.filter(push_timestamp__gt=self._max_timestamp).order_by('-id')[0].id
        older_ids = self._manager.filter(
            push_timestamp__lte=self._max_timestamp, id__lte=max_id
        ).order_by('id')[: self._chunk_size]

        return len(older_ids) or self._chunk_size


class TryDataRemoval(RemovalStrategy):
    """
    Removes `performance_datum` rows
    that originate from `try` repository and
    that are more than 6 weeks old.
    """

    SIGNATURE_BULK_SIZE = 10

    def __init__(self, chunk_size: int):
        self._cycle_interval = timedelta(weeks=6)
        self._chunk_size = chunk_size
        self._max_timestamp = datetime.now() - self._cycle_interval
        self._manager = PerformanceDatum.objects

        self.__try_repo_id = None
        self.__target_signatures = None
        self.__try_signatures = None

    @property
    def try_repo(self):
        if self.__try_repo_id is None:
            self.__try_repo_id = Repository.objects.get(name='try').id
        return self.__try_repo_id

    @property
    def target_signatures(self):
        if self.__target_signatures is None:
            self.__target_signatures = self.try_signatures[: self.SIGNATURE_BULK_SIZE]
        return self.__target_signatures

    @property
    def try_signatures(self):
        if self.__try_signatures is None:
            self.__try_signatures = list(
                PerformanceSignature.objects.filter(repository=self.try_repo)
                .order_by('-id')
                .values_list('id', flat=True)
            )
        return self.__try_signatures

    def remove(self, using: CursorWrapper):
        """
        @type using: database connection cursor
        """

        while True:
            self.__attempt_remove(using)

            deleted_rows = using.rowcount
            if deleted_rows > 0:
                break  # deletion was successful

            try:
                self.__lookup_new_signature()  # to remove data from
            except LookupError as ex:
                logger.debug(f'Could not target any new signature to delete data from. {ex}')
                break

    @property
    def name(self) -> str:
        return 'try data removal strategy'

    def __attempt_remove(self, using):
        total_signatures = len(self.target_signatures)
        from_target_signatures = ' OR '.join(['signature_id =  %s'] * total_signatures)

        delete_try_data = f'''
            DELETE FROM `performance_datum`
            WHERE repository_id = %s AND push_timestamp <= %s AND ({from_target_signatures})
            LIMIT %s
        '''

        using.execute(
            delete_try_data,
            [self.try_repo, self._max_timestamp, *self.target_signatures, self._chunk_size],
        )

    def __lookup_new_signature(self):
        self.__target_signatures = self.__try_signatures[: self.SIGNATURE_BULK_SIZE]
        del self.__try_signatures[: self.SIGNATURE_BULK_SIZE]

        if len(self.__target_signatures) == 0:
            raise LookupError('Exhausted all signatures originating from try repository.')


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
        data_cycler = self.fabricate_data_cycler(options)
        data_cycler.cycle()

    def fabricate_data_cycler(self, options):
        data_source = options.pop('data_source') or TREEHERDER_SUBCOMMAND
        data_source = data_source.split(':')[1]

        cls = self.CYCLER_CLASSES[data_source]
        return cls(**options)
