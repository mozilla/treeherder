import datetime
from collections import Counter
from operator import itemgetter as get_key

import pytest

from treeherder.model.models import Job
from treeherder.perf.alerts import IdentifyAlertRetriggerables
from treeherder.perf.models import PerformanceDatum

NON_RETRIGGERABLE_JOB_ID = 9
ONE_DAY_INTERVAL = datetime.timedelta(days=1)


@pytest.fixture
def gapped_performance_data(test_perf_signature, eleven_jobs_stored, test_perf_alert):
    """
    Graph view looks like:

 (score/ms)
    ^
    | | | | | | | | | |
    | | | | | | |o| | | <\
    | |o| | | | | | | | <- suspect range (should also be selected for retrigger)
    |o| | | | | | | |o| </
    | | | |0| | | | | | <- highlighted (has alert)
    | | | | | | | | | |
    +----------------->(time)
    |1|2|3|4|5|6|7|8|9 push & job ids (conveniently, our fixture job.id == job.push.id)
    """
    return prepare_graph_data_scenario(
        push_ids_to_keep=[1, 2, 4, 7, 9],
        highlighted_push_id=4,
        perf_alert=test_perf_alert,
        perf_signature=test_perf_signature,
    )


@pytest.fixture
def single_performance_datum(test_perf_signature, eleven_jobs_stored, test_perf_alert):
    """
    Graph view looks like:

 (score/ms)
    ^
    | | | | | | | | | |
    | | | | | | | | | |
    | | | | | | | | | |
    | | | | | | | | | |
    | | | |0| | | | | | <- highlighted (has alert)
    | | | | | | | | | |
    +----------------->(time)
    |1|2|3|4|5|6|7|8|9 push & job ids (our fixture job.id == job.push.id)
    """

    return prepare_graph_data_scenario(
        push_ids_to_keep=[4],
        highlighted_push_id=4,
        perf_alert=test_perf_alert,
        perf_signature=test_perf_signature,
    )


@pytest.fixture
def retriggerable_and_nonretriggerable_performance_data(
    test_perf_signature, eleven_jobs_stored, test_perf_alert
):
    """
    Graph view looks like:

 (score/ms)
    ^
    | | | | | | | | | |
    | | | | | | | | | |
    | | | | | | | | | |
    | | | | | | | | |o| <- shouldn't retrigger this
    | | | |0| | | | | | <- highlighted (has alert)
    | | | | | | | | | |
    +----------------->(time)
    |1|2|3|4|5|6|7|8|9 push & job ids (our fixture job.id == job.push.id)
    """
    out_of_retrigger_range = datetime.datetime(year=2014, month=1, day=1)

    prepare_graph_data_scenario(
        push_ids_to_keep=[
            4,
            NON_RETRIGGERABLE_JOB_ID,
        ],  # generally, fixture job ids == parent push id
        highlighted_push_id=4,
        perf_alert=test_perf_alert,
        perf_signature=test_perf_signature,
    )

    # make 2nd data point recent enough so it
    # won't get selected for retriggering

    # nonretrigerrable_
    nonr_job = Job.objects.filter(push_id=9)[0]
    nonr_perf_datum = PerformanceDatum.objects.filter(push_id=9)[0]

    nonr_job.push.time = out_of_retrigger_range
    nonr_perf_datum.push_timestamp = out_of_retrigger_range

    nonr_job.push.save()
    nonr_perf_datum.save()

    return PerformanceDatum.objects.all()


def prepare_graph_data_scenario(push_ids_to_keep, highlighted_push_id, perf_alert, perf_signature):
    original_job_count = Job.objects.count()
    selectable_jobs = Job.objects.filter(push_id__in=push_ids_to_keep).order_by('push_id')
    Job.objects.exclude(push_id__in=push_ids_to_keep).delete()

    assert Job.objects.count() < original_job_count

    perf_alert.summary.push_id = highlighted_push_id
    perf_alert.summary.save()
    perf_alert.save()

    for job in selectable_jobs:
        perf_datum = PerformanceDatum.objects.create(
            value=10,
            push_timestamp=job.push.time,
            job=job,
            push=job.push,
            repository=job.repository,
            signature=perf_signature,
        )
        perf_datum.push.time = job.push.time
        perf_datum.push.save()
    return PerformanceDatum.objects.all()


# Unit tests
def test_identify_retriggerables_as_unit():
    # basic instantiation & usage
    one_day = datetime.timedelta(days=1)

    with pytest.raises(ValueError):
        _ = IdentifyAlertRetriggerables(max_data_points=0, time_interval=one_day)

    with pytest.raises(ValueError):
        _ = IdentifyAlertRetriggerables(max_data_points=4, time_interval=one_day)

    with pytest.raises(TypeError):
        _ = IdentifyAlertRetriggerables(max_data_points=5, time_interval=1)

    # its small private methods
    annotated_data_points = [
        {'job_id': 1, 'push_id': 1},
        {'job_id': 2, 'push_id': 2},
        {'job_id': 3, 'push_id': 2},
        {'job_id': 4, 'push_id': 3},
        {'job_id': 5, 'push_id': 3},
        {'job_id': 6, 'push_id': 3},
    ]
    operation = IdentifyAlertRetriggerables(max_data_points=5, time_interval=one_day)
    flattened_data_points = operation._one_data_point_per_push(annotated_data_points)
    push_counter = Counter([data_point['push_id'] for data_point in flattened_data_points])

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

    assert len(data_points_to_retrigger) == 5
    assert {1, 2, 4, 7, 9} == set(map(get_key("job_id"), data_points_to_retrigger))

    # timestamps are around November 13, 2019
    push_timestamps = list(map(get_key("push_timestamp"), data_points_to_retrigger))
    min_push_timestmap = min(push_timestamps)
    max_push_timestamp = max(push_timestamps)

    assert datetime.datetime(year=2013, month=11, day=12) <= min_push_timestmap
    assert max_push_timestamp <= datetime.datetime(year=2013, month=11, day=14)


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
