import csv
from dataclasses import dataclass, asdict, replace, fields
import logging
from multiprocessing import cpu_count
from multiprocessing.pool import Pool, ThreadPool, AsyncResult
import time
from typing import Tuple, Dict, Union, List

from datetime import datetime, timedelta

from treeherder.perf.exceptions import NoFiledBugs
from .bugzilla_formulas import BugzillaFormula, EngineerTractionFormula, FixRatioFormula
from treeherder.utils import PROJECT_ROOT

CRITERIA_FILENAME = "perf-sheriffing-criteria.csv"

LOGGER = logging.getLogger(__name__)


@dataclass
class CriteriaRecord:
    Framework: str
    Suite: str
    Test: str
    EngineerTraction: Union[float, str]
    FixRatio: Union[float, str]
    TotalAlerts: int
    LastUpdatedOn: datetime
    AllowSync: bool

    def __post_init__(self):
        if self.EngineerTraction not in ("", "N/A"):
            self.EngineerTraction = float(self.EngineerTraction)
        if self.FixRatio not in ("", "N/A"):
            self.FixRatio = float(self.FixRatio)
        if self.TotalAlerts not in ("", "N/A"):
            self.TotalAlerts = int(self.TotalAlerts)

        if self.LastUpdatedOn != "":
            if isinstance(self.LastUpdatedOn, str):
                self.LastUpdatedOn = datetime.fromisoformat(self.LastUpdatedOn)

        if self.AllowSync in ("", "True"):
            self.AllowSync = True
        elif self.AllowSync == "False":
            self.AllowSync = False


class RecordComputer:
    def __init__(
        self,
        formula_map: Dict[str, BugzillaFormula],
        time_until_expires: timedelta,
        webservice_rest_time: timedelta,
        logger=None,
    ):
        self._time_until_expires = time_until_expires
        self._formula_map = formula_map
        self._seconds_to_rest = webservice_rest_time.total_seconds()
        self.log = logger or LOGGER

    def should_update(self, record: CriteriaRecord) -> bool:
        engineer_traction = record.EngineerTraction
        fix_ratio = record.FixRatio
        last_updated_on = record.LastUpdatedOn

        # consider explicit request above all else
        if not record.AllowSync:
            return False

        # missing data
        if "" in (engineer_traction, fix_ratio, last_updated_on):
            return True

        # expired data
        since_last_update = datetime.utcnow() - last_updated_on
        if since_last_update > self._time_until_expires:
            return True

        return False

    def apply_formulas(self, record: CriteriaRecord) -> CriteriaRecord:
        for form_name, formula in self._formula_map.items():
            try:
                result = formula(record.Framework, record.Suite, record.Test)
            except (NoFiledBugs, Exception) as ex:
                result = "N/A"
                self.__log_unexpected(ex, form_name, record)

            record = replace(
                record,
                **{form_name: result, "LastUpdatedOn": datetime.utcnow().isoformat()},
            )
            self.__let_web_service_rest_a_bit()
        return record

    def __log_unexpected(self, exception: Exception, formula_name: str, record: CriteriaRecord):
        if type(Exception) is NoFiledBugs:
            # maybe web service problem
            self.log.info(exception)
        elif type(exception) is Exception:
            # maybe web service problem
            self.log.warning(
                f"Unexpected exception when applying {formula_name} formula over {record.Framework} - {record.Suite}: {exception}"
            )

    def __let_web_service_rest_a_bit(self):
        # so we don't overload Bugzilla's endpoints
        time.sleep(self._seconds_to_rest)


class ConcurrencyStrategy:
    def __init__(
        self,
        pool_class: Pool,
        thread_wait: timedelta,
        check_interval: timedelta,
        cpu_allocation: float,
        threads_per_cpu: int,
        logger=None,
    ):
        self._pool_class = pool_class
        self._thread_wait = thread_wait
        self._check_interval = check_interval
        self._cpu_alloc = cpu_allocation
        self._threads_per_cpu = threads_per_cpu
        self.log = logger or LOGGER

        if not issubclass(self._pool_class, Pool):
            raise TypeError(f"Expected Pool (sub)class parameter. Got {self._pool_class} instead")
        if type(thread_wait) is not timedelta:
            raise TypeError("Expected timedelta parameter.")
        if type(check_interval) is not timedelta:
            raise TypeError("Expected timedelta parameter.")

    def pool(self):
        size = self.figure_out_pool_size()
        self.log.debug(f"Preparing a {self._pool_class.__name__} of size {size}...")
        return self._pool_class(size)

    def figure_out_pool_size(self) -> int:
        cpus_to_allocate = int(cpu_count() * self._cpu_alloc)
        threads_per_cpu = self._threads_per_cpu

        return max(cpus_to_allocate * threads_per_cpu, threads_per_cpu)

    @property
    def thread_wait(self):
        return self._thread_wait

    @property
    def check_interval(self):
        return self._check_interval


class ResultsChecker:
    def __init__(self, check_interval, timeout_after: timedelta, logger=None):
        self._check_interval = check_interval
        self._timeout_after = timeout_after
        self.log = logger or LOGGER

        self.__last_change = 0
        self.__since_last_change = timedelta(seconds=0)

    def wait_for_results(self, results: List[AsyncResult]):
        self.__reset_change_track()

        while True:
            last_check_on = time.time()
            if all(r.ready() for r in results):
                self.log.info("Finished computing updates for all records.")
                break
            time.sleep(self._check_interval.total_seconds())

            if self.__updates_stagnated(results, last_check_on):
                raise TimeoutError

            ready = [r for r in results if r.ready()]
            self.log.info(
                f"Haven't computed updates for all records yet (only {len(ready)} out of {len(results)}). Still waiting..."
            )

    def __updates_stagnated(self, results: List[AsyncResult], last_check_on: float) -> bool:
        ready_amount = len([r for r in results if r.ready()])
        total_results = len(results)
        new_change = total_results - ready_amount

        if new_change != self.__last_change:
            self.__reset_change_track(new_change)

        if self.__since_last_change > self._timeout_after:
            return True

        self.__since_last_change = self.__since_last_change + timedelta(
            seconds=(time.time() - last_check_on)
        )
        return False

    def __reset_change_track(self, last_change=None):
        self.__last_change = last_change or 0
        self.__since_last_change = timedelta(seconds=0)


class CriteriaTracker:
    TIME_UNTIL_EXPIRES = timedelta(days=3)

    ENGINEER_TRACTION = "EngineerTraction"
    FIX_RATIO = "FixRatio"
    FIELDNAMES = [field.name for field in fields(CriteriaRecord)]

    # Instance defaults
    RECORD_PATH = (PROJECT_ROOT / CRITERIA_FILENAME).resolve()

    def __init__(
        self,
        formula_map: Dict[str, BugzillaFormula] = None,
        record_path: str = None,
        webservice_rest_time: timedelta = None,
        multiprocessed: bool = False,
        logger=None,
    ):
        self.log = logger or LOGGER
        self._formula_map = formula_map or self.create_formula_map()
        self._record_path = record_path or self.RECORD_PATH
        self.fetch_strategy = self.create_fetch_strategy(multiprocessed)
        self._explicit_rest_time = webservice_rest_time is not None
        self._rest_time = (
            webservice_rest_time
            if webservice_rest_time is not None
            else self.fetch_strategy.thread_wait
        )  # wait time for Bugzilla web service, between individual formulas
        self._computer = RecordComputer(self._formula_map, self.TIME_UNTIL_EXPIRES, self._rest_time)
        self._records_map = {}

        for formula in self._formula_map.values():
            if not callable(formula):
                raise TypeError("Must provide callable as sheriffing criteria formula")

    def get_test_moniker(self, record: CriteriaRecord) -> Tuple[str, str, str]:
        return record.Framework, record.Suite, record.Test

    def __iter__(self):
        # through criteria records
        return iter(self._records_map.values())

    def load_records(self):
        self.log.info(f"Loading records from {self._record_path}...")
        self._records_map = {}  # reset them

        with open(self._record_path, "r") as csv_file:
            reader = csv.DictReader(csv_file)
            for row in reader:
                test_moniker = row.get("Framework"), row.get("Suite"), row.get("Test")
                self._records_map[test_moniker] = CriteriaRecord(**row)
        self.log.debug(f"Loaded {len(self._records_map)} records")

    def update_records(self):
        self.log.info("Updating records...")
        result_checker = ResultsChecker(self.__check_interval(), timeout_after=timedelta(minutes=5))

        with self.fetch_strategy.pool() as pool:
            results = [
                pool.apply_async(self.compute_record_update, (record,))
                for record in self._records_map.values()
            ]

            result_checker.wait_for_results(results)  # to finish

            for result in results:
                if not result.successful():
                    continue
                record = result.get()
                test_moniker = self.get_test_moniker(record)
                self._records_map[test_moniker] = record
            self.log.debug("Updated all records internally")

            self.log.info(f"Updating CSV file at {self._record_path}...")
            self.__dump_records()

    def compute_record_update(self, record: CriteriaRecord) -> CriteriaRecord:
        self.log.info(f"Computing update for record {record}...")
        if self.__should_update(record):
            record = self._computer.apply_formulas(record)
        return record

    def create_formula_map(self) -> Dict[str, BugzillaFormula]:
        return {
            self.ENGINEER_TRACTION: EngineerTractionFormula(),
            self.FIX_RATIO: FixRatioFormula(),
        }

    def create_fetch_strategy(self, multiprocessed: bool) -> ConcurrencyStrategy:
        options = {  # thread pool defaults
            "pool_class": ThreadPool,
            "thread_wait": timedelta(seconds=10),
            "check_interval": timedelta(seconds=10),
            "cpu_allocation": 0.75,
            "threads_per_cpu": 12,
            "logger": self.log,
        }
        if multiprocessed:
            options = {  # process pool defaults (overrides upper ones)
                "pool_class": Pool,
                "thread_wait": timedelta(seconds=1.5),
                "check_interval": timedelta(seconds=4),
                "cpu_allocation": 0.8,
                "threads_per_cpu": 12,
                "logger": self.log,
            }
        return ConcurrencyStrategy(**options)

    def __should_update(self, record: CriteriaRecord) -> bool:
        """
        convenience method for delegating
        """
        return self._computer.should_update(record)

    def __check_interval(self):
        wait_time = self.fetch_strategy.check_interval
        if self._explicit_rest_time:
            wait_time = self._rest_time

        return wait_time

    def __dump_records(self):
        with open(self._record_path, "w") as csv_file:
            writer = csv.DictWriter(csv_file, self.FIELDNAMES)

            writer.writeheader()
            for record in self._records_map.values():
                writer.writerow(asdict(record))
