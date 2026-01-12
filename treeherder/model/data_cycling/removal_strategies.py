from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from itertools import cycle

from django.db.backends.utils import CursorWrapper

from treeherder.model.models import Repository
from treeherder.perf.models import PerformanceDatum, PerformanceSignature

from .utils import has_valid_explicit_days

logger = logging.getLogger(__name__)


class RemovalStrategy(ABC):
    @property
    @abstractmethod
    def cycle_interval(self) -> int:
        """
        expressed in days
        """
        pass

    @has_valid_explicit_days
    def __init__(self, chunk_size: int, days: int = None):
        days = days or self.cycle_interval

        self._cycle_interval = timedelta(days=days)
        self._chunk_size = chunk_size
        self._max_timestamp = datetime.now() - self._cycle_interval

    @abstractmethod
    def remove(self, using: CursorWrapper):
        pass

    @property
    @abstractmethod
    def max_timestamp(self) -> datetime:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @staticmethod
    def fabricate_all_strategies(*args, **kwargs) -> list[RemovalStrategy]:
        return [
            MainRemovalStrategy(*args, **kwargs),
            TryDataRemoval(*args, **kwargs),
            IrrelevantDataRemoval(*args, **kwargs),
            StalledDataRemoval(*args, **kwargs),
            # append here any new strategies
            # ...
        ]


class MainRemovalStrategy(RemovalStrategy):
    """
    Removes `performance_datum` rows
    that are at least 1 year old.
    """

    @property
    def cycle_interval(self) -> int:
        # WARNING!! Don't override this without proper approval!
        return 365  # days                                     #
        ########################################################

    def __init__(self, chunk_size: int, days: int = None):
        super().__init__(chunk_size, days=days)
        self._manager = PerformanceDatum.objects

    @property
    def max_timestamp(self):
        return self._max_timestamp

    def remove(self, using: CursorWrapper):
        """
        Raw SQL is used here to avoid Django ORM cascade deletion, which can cause
        database overload on large related tables (e.g. performance_datum_replicate).
        """
        chunk_size = self._find_ideal_chunk_size()
        using.execute(
            """
            WITH target_datum AS (
                SELECT pd.id, pd.push_timestamp
                FROM performance_datum pd
                WHERE pd.push_timestamp <= %s
                ORDER BY pd.push_timestamp
                LIMIT %s
            ),
            del_replicate AS (
                DELETE FROM performance_datum_replicate r1
                WHERE r1.performance_datum_id IN (
                    SELECT td.id
                    FROM target_datum td
                    WHERE td.push_timestamp <= %s
                    AND EXISTS (
                        SELECT 1
                        FROM performance_datum_replicate r2
                        WHERE r2.performance_datum_id = td.id
                    )
                )
            ),
            del_multi AS (
                DELETE FROM perf_multicommitdatum pm
                USING target_datum td
                WHERE pm.perf_datum_id = td.id
            )
            DELETE FROM performance_datum pd
            USING target_datum td
            WHERE pd.id = td.id
            """,
            [self._max_timestamp, chunk_size, self._max_timestamp],
        )

    @property
    def name(self) -> str:
        return "main removal strategy"

    def _find_ideal_chunk_size(self) -> int:
        max_id = self._manager.filter(push_timestamp__gt=self._max_timestamp).order_by("-id")[0].id
        older_ids = self._manager.filter(
            push_timestamp__lte=self._max_timestamp, id__lte=max_id
        ).order_by("id")[: self._chunk_size]

        return len(older_ids) or self._chunk_size


class TryDataRemoval(RemovalStrategy):
    """
    Removes `performance_datum` rows
    that originate from `try` repository and
    that are more than 6 weeks old.
    """

    SIGNATURE_BULK_SIZE = 10

    @property
    def cycle_interval(self) -> int:
        # WARNING!! Don't override this without proper approval!
        return 42  # days                                      #
        ########################################################

    def __init__(self, chunk_size: int, days: int = None):
        super().__init__(chunk_size, days=days)

        self.__try_repo_id = None
        self.__target_signatures = None
        self.__try_signatures = None

    @property
    def max_timestamp(self):
        return self._max_timestamp

    @property
    def try_repo(self):
        if self.__try_repo_id is None:
            self.__try_repo_id = Repository.objects.get(name="try").id
        return self.__try_repo_id

    @property
    def target_signatures(self):
        if self.__target_signatures is None:
            self.__target_signatures = self.try_signatures[: self.SIGNATURE_BULK_SIZE]
            if len(self.__target_signatures) == 0:
                msg = "No try signatures found."
                logger.warning(msg)  # no try data is not normal
                raise LookupError(msg)
        return self.__target_signatures

    @property
    def try_signatures(self):
        if self.__try_signatures is None:
            self.__try_signatures = list(
                PerformanceSignature.objects.filter(repository=self.try_repo)
                .order_by("-id")
                .values_list("id", flat=True)
            )
        return self.__try_signatures

    def remove(self, using: CursorWrapper):
        """
        @type using: database connection cursor
        """

        while True:
            try:
                self.__attempt_remove(using)

                deleted_rows = using.rowcount
                if deleted_rows > 0:
                    break  # deletion was successful

                self.__lookup_new_signature()  # to remove data from
            except LookupError as ex:
                logger.debug(f"Could not target any (new) try signature to delete data from. {ex}")
                break

    @property
    def name(self) -> str:
        return "try data removal strategy"

    def __attempt_remove(self, using):
        using.execute(
            """
            WITH target_datum AS (
                SELECT pd.id, pd.repository_id, pd.push_timestamp, pd.signature_id
                FROM performance_datum pd
                WHERE pd.repository_id = %s
                AND pd.push_timestamp <= %s
                AND pd.signature_id = ANY(%s)
                LIMIT %s
            ),
            del_replicate AS (
                DELETE FROM performance_datum_replicate r1
                WHERE r1.performance_datum_id IN (
                    SELECT td.id
                    FROM target_datum td
                    WHERE td.repository_id = %s
                    AND td.push_timestamp <= %s
                    AND td.signature_id = ANY(%s)
                    AND EXISTS (
                        SELECT 1
                        FROM performance_datum_replicate r2
                        WHERE r2.performance_datum_id = td.id
                    )
                )
            ),
            del_multi AS (
                DELETE FROM perf_multicommitdatum pm
                USING target_datum td
                WHERE pm.perf_datum_id = td.id
            )
            DELETE FROM performance_datum pd
            USING target_datum td
            WHERE pd.id = td.id
            """,
            [
                self.try_repo,
                self._max_timestamp,
                list(self.target_signatures),
                self._chunk_size,
                self.try_repo,
                self._max_timestamp,
                list(self.target_signatures),
            ],
        )

    def __lookup_new_signature(self):
        self.__target_signatures = self.__try_signatures[: self.SIGNATURE_BULK_SIZE]
        del self.__try_signatures[: self.SIGNATURE_BULK_SIZE]

        if len(self.__target_signatures) == 0:
            raise LookupError("Exhausted all signatures originating from try repository.")


class IrrelevantDataRemoval(RemovalStrategy):
    """
    Removes `performance_datum` rows that originate
    from repositories, other than the ones mentioned
    in `RELEVANT_REPO_NAMES`, that are more than 6 months old.
    """

    RELEVANT_REPO_NAMES = [
        "autoland",
        "mozilla-central",
        "mozilla-beta",
        "fenix",
        "reference-browser",
    ]

    @property
    def cycle_interval(self) -> int:
        # WARNING!! Don't override this without proper approval!
        return 180  # days                                     #
        ########################################################

    def __init__(self, chunk_size: int, days: int = None):
        super().__init__(chunk_size, days=days)

        self._manager = PerformanceDatum.objects
        self.__irrelevant_repos = None
        self.__circular_repos = None

    @property
    def max_timestamp(self):
        return self._max_timestamp

    @property
    def irrelevant_repositories(self):
        if self.__irrelevant_repos is None:
            self.__irrelevant_repos = list(
                Repository.objects.exclude(name__in=self.RELEVANT_REPO_NAMES).values_list(
                    "id", flat=True
                )
            )
        return self.__irrelevant_repos

    @property
    def irrelevant_repo(self):
        if self.__circular_repos is None:
            self.__circular_repos = cycle(self.irrelevant_repositories)
        return next(self.__circular_repos)

    @property
    def name(self) -> str:
        return "irrelevant data removal strategy"

    def remove(self, using: CursorWrapper):
        chunk_size = self._find_ideal_chunk_size()
        repository_id = self.irrelevant_repo
        using.execute(
            """
            WITH target_datum AS (
                SELECT pd.id, pd.repository_id, pd.push_timestamp
                FROM performance_datum pd
                WHERE pd.repository_id = %s
                AND pd.push_timestamp <= %s
                LIMIT %s
            ),
            del_replicate AS (
                DELETE FROM performance_datum_replicate r1
                WHERE r1.performance_datum_id IN (
                    SELECT td.id
                    FROM target_datum td
                    WHERE td.repository_id = %s
                    AND td.push_timestamp <= %s
                    AND EXISTS (
                        SELECT 1
                        FROM performance_datum_replicate r2
                        WHERE r2.performance_datum_id = td.id
                    )
                )
            ),
            del_multi AS (
                DELETE FROM perf_multicommitdatum pm
                USING target_datum td
                WHERE pm.perf_datum_id = td.id
            )
            DELETE FROM performance_datum pd
            USING target_datum td
            WHERE pd.id = td.id
            """,
            [repository_id, self._max_timestamp, chunk_size, repository_id, self._max_timestamp],
        )

    def _find_ideal_chunk_size(self) -> int:
        max_id_of_non_expired_row = (
            self._manager.filter(push_timestamp__gt=self._max_timestamp)
            .filter(repository_id__in=self.irrelevant_repositories)
            .order_by("-id")[0]
            .id
        )
        older_perf_data_rows = (
            self._manager.filter(
                push_timestamp__lte=self._max_timestamp, id__lte=max_id_of_non_expired_row
            )
            .filter(repository_id__in=self.irrelevant_repositories)
            .order_by("id")[: self._chunk_size]
        )
        return len(older_perf_data_rows) or self._chunk_size


class StalledDataRemoval(RemovalStrategy):
    """
    Removes `performance_datum` rows from `performance_signature`s
    that haven't been updated in the last 4 months.

    Exception: `performance_datum` rows that have a historical value (`autoland` /
    `mozilla-central` series with an average of 2 data points per month)
    are excluded and are kept for 1 year.
    """

    @property
    def cycle_interval(self) -> int:
        # WARNING!! Don't override this without proper approval!
        return 120  # days                                     #
        ########################################################

    def __init__(self, chunk_size: int, days: int = None):
        super().__init__(chunk_size, days=days)

        self._target_signature = None
        self._removable_signatures = None

    @property
    def target_signature(self) -> PerformanceSignature:
        try:
            if self._target_signature is None:
                self._target_signature = self.removable_signatures.pop()
        except IndexError:
            msg = "No stalled signature found."
            logger.warning(msg)  # no stalled data is not normal
            raise LookupError(msg)
        return self._target_signature

    @property
    def removable_signatures(self) -> list[PerformanceSignature]:
        if self._removable_signatures is None:
            self._removable_signatures = list(
                PerformanceSignature.objects.filter(last_updated__lte=self._max_timestamp).order_by(
                    "last_updated"
                )
            )
            self._removable_signatures = [
                sig
                for sig in self._removable_signatures
                if not sig.has_data_with_historical_value()
            ]
        return self._removable_signatures

    def remove(self, using: CursorWrapper):
        while True:
            try:
                self.__attempt_remove(using)

                deleted_rows = using.rowcount
                if deleted_rows > 0:
                    break  # deletion was successful

                self.__lookup_new_signature()  # to remove data from
            except LookupError as ex:
                logger.debug(
                    f"Could not target any (new) stalled signature to delete data from. {ex}"
                )
                break

    @property
    def max_timestamp(self) -> datetime:
        return self._max_timestamp

    @property
    def name(self) -> str:
        return "stalled data removal strategy"

    def __attempt_remove(self, using: CursorWrapper):
        using.execute(
            """
            WITH target_datum AS (
                SELECT pd.id, pd.repository_id, pd.signature_id, pd.push_timestamp
                FROM performance_datum pd
                WHERE pd.repository_id = %s
                AND pd.signature_id = %s
                AND pd.push_timestamp <= %s
                LIMIT %s
            ),
            del_replicate AS (
                DELETE FROM performance_datum_replicate r1
                WHERE r1.performance_datum_id IN (
                    SELECT td.id
                    FROM target_datum td
                    WHERE td.repository_id = %s
                    AND td.signature_id = %s
                    AND td.push_timestamp <= %s
                    AND EXISTS (
                        SELECT 1
                        FROM performance_datum_replicate r2
                        WHERE r2.performance_datum_id = td.id
                    )
                )
            ),
            del_multi AS (
                DELETE FROM perf_multicommitdatum pm
                USING target_datum td
                WHERE pm.perf_datum_id = td.id
            )
            DELETE FROM performance_datum pd
            USING target_datum td
            WHERE pd.id = td.id
            """,
            [
                self.target_signature.repository_id,
                self.target_signature.id,
                self._max_timestamp,
                self._chunk_size,
                self.target_signature.repository_id,
                self.target_signature.id,
                self._max_timestamp,
            ],
        )

    def __lookup_new_signature(self):
        try:
            self._target_signature = self._removable_signatures.pop()
        except IndexError:
            raise LookupError("Exhausted all stalled signatures.")
