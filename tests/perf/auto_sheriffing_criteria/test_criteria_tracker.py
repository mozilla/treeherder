import copy
import time
from contextlib import contextmanager
from dataclasses import replace
from datetime import timedelta
from itertools import chain
from unittest.mock import MagicMock
from dateutil.parser import parse as dateutil_parse
from multiprocessing.pool import AsyncResult

import pytest
from freezegun import freeze_time

from tests.perf.auto_sheriffing_criteria.conftest import CASSETTES_RECORDING_DATE
from treeherder.perf.exceptions import NoFiledBugsError
from treeherder.perf.sheriffing_criteria import (
    CriteriaTracker,
    EngineerTractionFormula,
    FixRatioFormula,
    RecordComputer,
    CriteriaRecord,
    TotalAlertsFormula,
)
from treeherder.perf.sheriffing_criteria.criteria_tracking import ResultsChecker
from treeherder.utils import PROJECT_ROOT

pytestmark = [pytest.mark.freeze_time(CASSETTES_RECORDING_DATE, tick=True)]

RECORD_TEST_PATH = (PROJECT_ROOT / "tests/sample_data/criteria-records.csv").resolve()
EXPECTED_LAST_UPDATE = dateutil_parse(CASSETTES_RECORDING_DATE)
EXPECTED_VALUE = 0.5
TESTS_WITH_NO_DATA = [
    ("awsy", "Base Content Explicit", ""),
    ("browsertime", "allrecipes-cold", ""),
    ("raptor", "os-baseline-power", ""),
    ("talos", "a11yr", ""),
]
TESTS_WITH_EXPIRED_DATA = [
    ("awsy", "Base Content Heap Unclassified", ""),
    ("browsertime", "amazon", ""),
    ("build_metrics", "compiler warnings", ""),
    ("raptor", "raptor-ares6-firefox", ""),
    ("talos", "about_newtab_with_snippets", ""),
]
TESTS_WITH_UPDATED_DATA = [
    ("awsy", "Base Content JS", ""),
    ("browsertime", "amazon-cold", ""),
    ("build_metrics", "installer size", ""),
    ("raptor", "raptor-assorted-dom-firefox", ""),
    ("talos", "about_preferences_basic", ""),
]
recording_date = dateutil_parse(CASSETTES_RECORDING_DATE).isoformat()
RECORDS_WITH_NO_DATA = [
    CriteriaRecord(
        Framework=test[0],
        Suite=test[1],
        Test=test[2],
        EngineerTraction="",
        FixRatio="",
        TotalAlerts="",
        LastUpdatedOn="",
        AllowSync="",
    )
    for test in TESTS_WITH_NO_DATA
]
RECORDS_WITH_EXPIRED_DATA = [
    CriteriaRecord(
        Framework=test[0],
        Suite=test[1],
        Test=test[2],
        EngineerTraction=0.5,
        FixRatio=0.3,
        TotalAlerts=21,
        LastUpdatedOn="2020-05-02T00:00:00.000000",
        AllowSync="",
    )
    for test in TESTS_WITH_EXPIRED_DATA
]
RECORDS_WITH_UPDATED_DATA = [
    CriteriaRecord(
        Framework=test[0],
        Suite=test[1],
        Test=test[2],
        EngineerTraction=0.5,
        FixRatio=0.3,
        TotalAlerts=21,
        LastUpdatedOn="2020-06-02T00:00:00.000000",
        AllowSync="",
    )
    for test in TESTS_WITH_UPDATED_DATA
]
RECORDS_UNALLOWED_TO_SYNC = list(
    map(
        copy.deepcopy,
        chain(*zip(RECORDS_WITH_NO_DATA, RECORDS_WITH_EXPIRED_DATA, RECORDS_WITH_UPDATED_DATA)),
    )
)[:10]
RECORDS_UNALLOWED_TO_SYNC = [replace(rec, AllowSync=False) for rec in RECORDS_UNALLOWED_TO_SYNC]

NEVER_READY_RESULTS = [MagicMock(spec=AsyncResult) for _ in range(10)]
PARTIALLY_READY_RESULTS = [MagicMock(spec=AsyncResult) for _ in range(10)]
READY_RESULTS = [MagicMock(spec=AsyncResult) for _ in range(10)]
EVENTUALLY_READY_RESULTS = [MagicMock(spec=AsyncResult) for _ in range(10)]

for res in NEVER_READY_RESULTS:
    res.ready = MagicMock(return_value=False)
for res in PARTIALLY_READY_RESULTS:
    res.ready = MagicMock(return_value=True)
PARTIALLY_READY_RESULTS[-1].ready = MagicMock(return_value=False)

for res in READY_RESULTS:
    res.ready = MagicMock(return_value=True)


class EventuallyReady:
    def __init__(self, start_time: float, ready_after: float):
        print(f"start_time: {start_time}")
        self.start_time = start_time
        self.ready_after = ready_after

    def __call__(self):
        elapsed_time = time.time() - self.start_time
        if elapsed_time > self.ready_after:
            return True
        return False


with freeze_time(CASSETTES_RECORDING_DATE) as frozentime:
    for res in EVENTUALLY_READY_RESULTS:
        res.ready = MagicMock(
            side_effect=EventuallyReady(time.time(), 4 * 60 + 59)
        )  # ready just before timeout


class InvalidFormula:
    pass


@contextmanager
def should_take_more_than(seconds: float):
    start = time.time()
    yield
    it_took = time.time() - start

    if it_took < seconds:
        raise TimeoutError(
            f"Should have taken more than {seconds}. But it took only {it_took} seconds."
        )


@pytest.fixture
def updatable_criteria_csv(tmp_path):
    updatable_csv = tmp_path / "updatable-criteria.csv"
    with open(RECORD_TEST_PATH) as file_:
        updatable_csv.write_text(file_.read())

    return updatable_csv


@pytest.fixture
def mock_formula_map():
    return {
        "EngineerTraction": MagicMock(spec=EngineerTractionFormula, return_value=EXPECTED_VALUE),
        "FixRatio": MagicMock(spec=FixRatioFormula, return_value=EXPECTED_VALUE),
        "TotalAlerts": MagicMock(spec=FixRatioFormula, return_value=0),
    }


@pytest.mark.parametrize(
    "invalid_formulas",
    [
        {"EngineerTraction": InvalidFormula(), "FixRatio": InvalidFormula()},
        {"EngineerTraction": None, "FixRatio": None},
    ],
)
def test_tracker_throws_error_for_invalid_formulas(invalid_formulas):
    with pytest.raises(TypeError):
        CriteriaTracker(formula_map=invalid_formulas)


def test_tracker_throws_error_if_no_record_file_found(tmp_path):
    nonexistent_file = str(tmp_path / "perf-sheriffing-criteria.csv")
    tracker = CriteriaTracker(record_path=nonexistent_file)

    with pytest.raises(FileNotFoundError):
        tracker.load_records()


def test_tracker_has_a_list_of_records():
    tracker = CriteriaTracker(record_path=RECORD_TEST_PATH)
    tracker.load_records()

    record_list = list(iter(tracker))
    assert len(record_list) == 5


@pytest.mark.parametrize("criteria_record", RECORDS_WITH_NO_DATA)
def test_record_computer_can_tell_missing_data(criteria_record):
    computer = RecordComputer({}, timedelta(days=3), timedelta(seconds=0))

    assert computer.should_update(criteria_record)


@pytest.mark.parametrize("criteria_record", RECORDS_WITH_EXPIRED_DATA)
def test_record_computer_can_tell_expired_data(criteria_record):
    computer = RecordComputer({}, timedelta(days=3), timedelta(seconds=0))

    assert computer.should_update(criteria_record)


@pytest.mark.parametrize("criteria_record", RECORDS_WITH_UPDATED_DATA)
def test_record_computer_can_tell_updated_data(criteria_record):
    computer = RecordComputer({}, timedelta(days=3), timedelta(seconds=0))

    assert not computer.should_update(criteria_record)


@pytest.mark.parametrize("criteria_record", RECORDS_UNALLOWED_TO_SYNC)
def test_record_computer_can_tell_unallowed_data(criteria_record):
    computer = RecordComputer({}, timedelta(days=3), timedelta(seconds=0))

    assert not computer.should_update(criteria_record)


@pytest.mark.freeze_time(CASSETTES_RECORDING_DATE)  # disable tick
@pytest.mark.parametrize("exception", [NoFiledBugsError(), Exception()])
def test_record_computer_still_updates_if_one_of_the_formulas_fails(exception, db):
    formula_map = {
        "EngineerTraction": MagicMock(spec=EngineerTractionFormula, return_value=EXPECTED_VALUE),
        "FixRatio": MagicMock(spec=FixRatioFormula, side_effect=exception),
        "TotalAlerts": TotalAlertsFormula(),
    }
    record = CriteriaRecord(
        Framework="talos",
        Suite="tp5n",
        Test="",
        EngineerTraction="",
        FixRatio="",
        TotalAlerts="",
        LastUpdatedOn="",
        AllowSync="",
    )

    computer = RecordComputer(formula_map, timedelta(days=3), timedelta(seconds=0))
    record = computer.apply_formulas(record)

    assert record.Framework == "talos"
    assert record.Suite == "tp5n"
    assert record.EngineerTraction == EXPECTED_VALUE
    assert record.FixRatio == "N/A"
    assert record.TotalAlerts == 0  # as the test database is empty
    assert record.LastUpdatedOn == EXPECTED_LAST_UPDATE
    assert record.AllowSync is True


def test_tracker_lets_web_service_rest(mock_formula_map, updatable_criteria_csv):
    tracker = CriteriaTracker(
        formula_map=mock_formula_map,
        record_path=str(updatable_criteria_csv),
        webservice_rest_time=timedelta(seconds=0.01),
    )
    tracker.load_records()

    with should_take_more_than(0.01):
        tracker.update_records()


# We cannot use freeze_time here as it breaks the multiprocessing & sleep usages in CriteriaTracker
def test_tracker_updates_records_with_missing_data(mock_formula_map, updatable_criteria_csv):
    # all tests from the fixture don't have any kind of data
    tracker = CriteriaTracker(
        formula_map=mock_formula_map,
        record_path=str(updatable_criteria_csv),
        webservice_rest_time=timedelta(seconds=0.0),
    )
    tracker.load_records()

    # CSV has no criteria data initially
    for criteria_rec in tracker:
        assert criteria_rec.EngineerTraction == ""
        assert criteria_rec.FixRatio == ""
        assert criteria_rec.TotalAlerts == ""
        assert criteria_rec.LastUpdatedOn == ""
        assert criteria_rec.AllowSync is True

    tracker.update_records()
    del tracker

    # let's re read with a separate tracker
    # to ensure data was cached & correct
    separate_tracker = CriteriaTracker(record_path=str(updatable_criteria_csv))
    separate_tracker.load_records()

    for criteria_rec in separate_tracker:
        assert criteria_rec.EngineerTraction == EXPECTED_VALUE
        assert criteria_rec.FixRatio == EXPECTED_VALUE
        assert criteria_rec.TotalAlerts == 0
        # We cannot compare exactly as the freeze_time method is not usable here
        assert criteria_rec.LastUpdatedOn > EXPECTED_LAST_UPDATE
        assert criteria_rec.AllowSync is True


@pytest.mark.freeze_time(CASSETTES_RECORDING_DATE, auto_tick_seconds=30)
@pytest.mark.parametrize("async_results", [NEVER_READY_RESULTS, PARTIALLY_READY_RESULTS])
def test_results_checker_timeouts_on_no_changes(async_results):
    checker = ResultsChecker(check_interval=timedelta(0.0), timeout_after=timedelta(minutes=5))

    with pytest.raises(TimeoutError):
        checker.wait_for_results(async_results)


@pytest.mark.freeze_time(CASSETTES_RECORDING_DATE, auto_tick_seconds=30)
@pytest.mark.parametrize("async_results", [READY_RESULTS, EVENTUALLY_READY_RESULTS])
def test_results_checker_doesnt_timeout_unexpectedly(async_results):
    checker = ResultsChecker(check_interval=timedelta(0.0), timeout_after=timedelta(minutes=5))

    try:
        checker.wait_for_results(async_results)
    except TimeoutError:
        pytest.fail()
