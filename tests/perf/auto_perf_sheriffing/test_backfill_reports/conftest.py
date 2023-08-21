import datetime
import random
import string
from copy import deepcopy
from unittest.mock import Mock

import pytest

from tests.conftest import create_perf_alert
from treeherder.model.models import Job, Option, OptionCollection, MachinePlatform
from treeherder.perf.auto_perf_sheriffing.backfill_reports import AlertsPicker
from treeherder.perf.models import PerformanceAlert, PerformanceDatum, PerformanceSignature

# For testing BackfillReportMaintainer
LETTERS = string.ascii_lowercase
RANDOM_STRINGS = set()


@pytest.fixture(scope='module')
def alerts_picker():
    # real-world instance
    return AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )


@pytest.fixture
def mock_backfill_context_fetcher(backfill_record_context):
    # because underlying data is hard to provide (performance datum, pushes, jobs etc)
    return Mock(return_value=backfill_record_context)


@pytest.fixture
def option_collection():
    option = Option.objects.create(name='opt')
    return OptionCollection.objects.create(option_collection_hash='my_option_hash', option=option)


@pytest.fixture
def relevant_platform():
    return MachinePlatform.objects.create(os_name='win', platform='windows10', architecture='x86')


@pytest.fixture
def irrelevant_platform():
    return MachinePlatform.objects.create(
        os_name='OS_OF_NO_INTEREST', platform='PLATFORM_OF_NO_INTEREST', architecture='x86'
    )


@pytest.fixture
def unique_random_string():
    global RANDOM_STRINGS, LETTERS

    def _unique_random_string(length=14):
        while True:
            random_string = ''.join(random.choice(LETTERS) for _ in range(length))
            if random_string not in RANDOM_STRINGS:
                RANDOM_STRINGS.add(random_string)
                return random_string

    return _unique_random_string


@pytest.fixture
def create_perf_signature(
    test_repository,
    test_perf_framework,
    option_collection,
    relevant_platform,
    irrelevant_platform,
    unique_random_string,
):
    def _create_perf_signature(relevant=True):
        platform = relevant_platform if relevant else irrelevant_platform

        signature = PerformanceSignature.objects.create(
            repository=test_repository,
            signature_hash=unique_random_string(40),
            framework=test_perf_framework,
            platform=platform,
            option_collection=option_collection,
            suite=unique_random_string(),
            test=unique_random_string(),
            has_subtests=False,
            last_updated=datetime.datetime.now(),
        )
        return signature

    return _create_perf_signature


@pytest.fixture
def create_alerts(create_perf_signature):
    def _create_alerts(summary, relevant=True, amount=3):
        alerts = []
        for _ in range(amount):
            alert = create_perf_alert(
                summary=summary, series_signature=create_perf_signature(relevant)
            )
            alerts.append(alert)
        return alerts

    return _create_alerts


# For testing AlertsPicker
@pytest.fixture
def test_many_various_alerts():
    alerts = [Mock(spec=PerformanceAlert) for _ in range(10)]
    platforms = (
        'windows10-64-shippable',
        'windows10-64-shippable',
        'windows7-32-shippable',
        'windows7-32-shippable',
        'linux64-shippable-qr',
        'linux64-shippable-qr',
        'osx-10-10-shippable',
        'osx-10-10-shippable',
        'android-hw-pix-7-1-android-aarch64',
        'android-hw-pix-7-1-android-aarch64',
    )

    reversed_magnitudes = list(reversed(range(len(alerts))))
    toggle = True
    for idx, alert in enumerate(alerts):
        alert.is_regression = toggle
        alert.noise_profile = "OK" if idx in [7, 8, 9] else "N/A"
        alert.series_signature.platform.platform = platforms[idx]
        alert.amount_pct = reversed_magnitudes[idx]
        toggle = not toggle
    return alerts


@pytest.fixture
def test_few_various_alerts():
    alerts = [Mock(spec=PerformanceAlert) for _ in range(2)]
    platforms = ('windows7-32-shippable', 'linux64-shippable-qr')
    reversed_magnitudes = list(reversed(range(len(alerts))))
    toggle = True
    for idx, alert in enumerate(alerts):
        alert.series_signature.platform.platform = platforms[idx]
        alert.is_regression = toggle
        alert.amount_pct = reversed_magnitudes[idx]
        toggle = not toggle
    return alerts


@pytest.fixture
def test_macosx_alert():
    alert = Mock(spec=PerformanceAlert)
    platform = 'macosx1015-64-shippable-qr'
    alert.series_signature.platform.platform = platform
    alert.is_regression = True
    return alert


@pytest.fixture
def test_few_regressions():
    alerts = [Mock(spec=PerformanceAlert) for _ in range(5)]
    platforms = (
        'windows10-64-shippable',
        'windows7-32-shippable',
        'linux64-shippable-qr',
        'osx-10-10-shippable',
        'android-hw-pix-7-1-android-aarch64',
    )
    reversed_magnitudes = list(reversed(range(len(alerts))))
    for idx, alert in enumerate(alerts):
        alert.series_signature.platform.platform = platforms[idx]
        alert.is_regression = True
        alert.amount_pct = reversed_magnitudes[idx]
    return alerts


@pytest.fixture
def test_few_improvements(test_few_regressions):
    alerts = deepcopy(test_few_regressions)
    for alert in alerts:
        alert.is_regression = False
    return alerts


@pytest.fixture
def test_bad_platform_names():
    alerts = [Mock(spec=PerformanceAlert) for _ in range(4)]
    platforms = (
        'rfvrtgb',  # noqa
        '4.0',
        '54dcwec58',  # noqa
        '8y6 t g',
    )
    for idx, alert in enumerate(alerts):
        alert.series_signature.platform.platform = platforms[idx]
    return alerts


# For testing IdentifyAlertRetriggerables
NON_RETRIGGERABLE_JOB_ID = 9
ONE_DAY_INTERVAL = datetime.timedelta(days=1)


def prepare_graph_data_scenario(push_ids_to_keep, highlighted_push_id, perf_alert, perf_signature):
    original_job_count = Job.objects.count()
    selectable_jobs = Job.objects.filter(push_id__in=push_ids_to_keep).order_by('push_id', 'id')
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
