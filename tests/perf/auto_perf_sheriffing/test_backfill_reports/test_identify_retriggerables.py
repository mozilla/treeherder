import datetime
from collections import Counter
from operator import itemgetter as get_key

import pytest

from treeherder.perf.auto_perf_sheriffing.backfill_reports import (
    IdentifyAlertRetriggerables,
)

from .conftest import NON_RETRIGGERABLE_JOB_ID, ONE_DAY_INTERVAL


# Unit tests
def test_identify_retriggerables_as_unit():
    # basic instantiation & usage
    one_day = datetime.timedelta(days=1)

    with pytest.raises(ValueError):
        _ = IdentifyAlertRetriggerables(max_data_points=0, time_interval=one_day)

    with pytest.raises(ValueError):
        _ = IdentifyAlertRetriggerables(max_data_points=4, time_interval=one_day)

    with pytest.raises(TypeError):
        _ = IdentifyAlertRetriggerables(max_data_points=5, time_interval=1)  # noqa

    # its small private methods
    annotated_data_points = [
        {"job_id": 1, "push_id": 1},
        {"job_id": 2, "push_id": 2},
        {"job_id": 3, "push_id": 2},
        {"job_id": 4, "push_id": 3},
        {"job_id": 5, "push_id": 3},
        {"job_id": 6, "push_id": 3},
    ]
    operation = IdentifyAlertRetriggerables(max_data_points=5, time_interval=one_day)
    flattened_data_points = operation._one_data_point_per_push(annotated_data_points)  # noqa
    push_counter = Counter([data_point["push_id"] for data_point in flattened_data_points])

    assert max(count for count in push_counter.values()) == 1

    with pytest.raises(LookupError):
        operation._find_push_id_index(10, annotated_data_points)

    alert_push_time = datetime.datetime(year=2019, month=8, day=21)
    expected_min_timestamp = datetime.datetime(year=2019, month=8, day=20)
    expected_max_timestamp = datetime.datetime(year=2019, month=8, day=22)

    assert operation.min_timestamp(alert_push_time) == expected_min_timestamp
    assert operation.max_timestamp(alert_push_time) == expected_max_timestamp


# Component tests
def test_identify_retriggerables_selects_all_data_points(gapped_performance_data, test_perf_alert):
    identify_retriggerables = IdentifyAlertRetriggerables(
        max_data_points=5, time_interval=ONE_DAY_INTERVAL
    )
    data_points_to_retrigger = identify_retriggerables(test_perf_alert)

    assert len(data_points_to_retrigger) == 1
    # NOTE: this is so intermittent it fails at least 30% of the time
    # assert {4} == set(map(get_key("job_id"), data_points_to_retrigger))

    # timestamps are around November 13, 2019
    push_timestamps = list(map(get_key("push_timestamp"), data_points_to_retrigger))
    min_push_timestamp = min(push_timestamps)
    max_push_timestamp = max(push_timestamps)

    assert datetime.datetime(year=2024, month=11, day=2) <= min_push_timestamp
    assert max_push_timestamp <= datetime.datetime(
        year=2025, month=2, day=27, hour=14, minute=41, second=1
    )


def test_identify_retriggerables_selects_even_single_data_point(
    single_performance_datum, test_perf_alert
):
    identify_retriggerables = IdentifyAlertRetriggerables(
        max_data_points=5, time_interval=ONE_DAY_INTERVAL
    )
    data_points_to_retrigger = identify_retriggerables(test_perf_alert)

    assert len(data_points_to_retrigger) == 1
    assert {4} == set(map(get_key("job_id"), data_points_to_retrigger))


def test_identify_retriggerables_doesnt_select_out_of_range_data_points(
    retriggerable_and_nonretriggerable_performance_data, test_perf_alert
):
    identify_retriggerables = IdentifyAlertRetriggerables(
        max_data_points=5, time_interval=ONE_DAY_INTERVAL
    )
    data_points_to_retrigger = identify_retriggerables(test_perf_alert)

    job_ids_to_retrigger = set(map(get_key("job_id"), data_points_to_retrigger))

    assert len(data_points_to_retrigger) == 1
    assert NON_RETRIGGERABLE_JOB_ID not in job_ids_to_retrigger
    assert {4} == job_ids_to_retrigger
