import logging
from abc import ABC, abstractmethod
from datetime import timedelta, datetime
from typing import List

from django.db import OperationalError, connection
from django.db.backends.utils import CursorWrapper
from django.db.models import Count

from treeherder.config import settings
from treeherder.model.data_cycling.removal_strategies import RemovalStrategy
from treeherder.model.models import Job, JobType, JobGroup, Machine
from treeherder.perf.exceptions import NoDataCyclingAtAll, MaxRuntimeExceeded
from treeherder.perf.models import PerformanceSignature, PerformanceAlertSummary
from treeherder.services.taskcluster import TaskclusterModel, DEFAULT_ROOT_URL as root_url
from .max_runtime import MaxRuntime
from .signature_remover import PublicSignatureRemover
from .utils import has_valid_explicit_days

logger = logging.getLogger(__name__)

TREEHERDER = 'treeherder'
PERFHERDER = 'perfherder'


class DataCycler(ABC):
    def __init__(
        self, chunk_size: int, sleep_time: int, is_debug: bool = None, days: int = None, **kwargs
    ):
        self.chunk_size = chunk_size
        self.sleep_time = sleep_time
        self.is_debug = is_debug or False

    @abstractmethod
    def cycle(self):
        pass


class TreeherderCycler(DataCycler):
    DEFAULT_CYCLE_INTERVAL = 120  # in days

    def __init__(
        self, chunk_size: int, sleep_time: int, is_debug: bool = None, days: int = None, **kwargs
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

        self._remove_leftovers()

    def _remove_leftovers(self):
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

    @has_valid_explicit_days
    def __init__(
        self,
        chunk_size: int,
        sleep_time: int,
        is_debug: bool = None,
        days: int = None,
        strategies: List[RemovalStrategy] = None,
        **kwargs,
    ):
        super().__init__(chunk_size, sleep_time, is_debug)
        self.strategies = strategies or RemovalStrategy.fabricate_all_strategies(
            chunk_size, days=days
        )
        self.timer = MaxRuntime()

    @property
    def max_timestamp(self):
        """
        Returns the most recent timestamp from all strategies.
        """
        strategy = max(self.strategies, key=lambda s: s.max_timestamp)
        return strategy.max_timestamp

    def cycle(self):
        """
        Delete data older than cycle_interval, splitting the target data
        into chunks of chunk_size size.
        """
        logger.warning(f"Cycling {PERFHERDER.title()} data...")
        self.timer.start_timer()

        try:
            for strategy in self.strategies:
                try:
                    logger.warning(f'Cycling data using {strategy.name}...')
                    self._delete_in_chunks(strategy)
                except NoDataCyclingAtAll as ex:
                    logger.warning(str(ex))

            self._remove_leftovers()
        except MaxRuntimeExceeded as ex:
            logger.warning(ex)

    def _remove_leftovers(self):
        # remove any signatures which are
        # no longer associated with a job
        signatures = PerformanceSignature.objects.filter(last_updated__lte=self.max_timestamp)
        tc_model = TaskclusterModel(
            root_url, client_id=settings.NOTIFY_CLIENT_ID, access_token=settings.NOTIFY_ACCESS_TOKEN
        )
        signatures_remover = PublicSignatureRemover(timer=self.timer, taskcluster_model=tc_model)
        signatures_remover.remove_in_chunks(signatures)

        # remove empty alert summaries
        logger.warning('Removing alert summaries which no longer have any alerts...')
        (
            PerformanceAlertSummary.objects.prefetch_related('alerts', 'related_alerts')
            .annotate(
                total_alerts=Count('alerts'),
                total_related_alerts=Count('related_alerts'),
            )
            .filter(
                total_alerts=0,
                total_related_alerts=0,
                # WARNING! Don't change this without proper approval!           #
                # Otherwise we risk deleting data that's actively investigated  #
                # and cripple the perf sheriffing process!                      #
                created__lt=(datetime.now() - timedelta(days=180)),
                #################################################################
            )
            .delete()
        )

    def _delete_in_chunks(self, strategy: RemovalStrategy):
        any_successful_attempt = False

        with connection.cursor() as cursor:
            while True:
                self.timer.quit_on_timeout()

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
                        logger.debug(
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
