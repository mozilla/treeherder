import datetime

from treeherder.model.models import (MachinePlatform,
                                     Option,
                                     OptionCollection)
from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)


def test_detect_alerts_in_series(test_project, test_repository):
    framework = PerformanceFramework.objects.create(
        name='test_talos')
    option = Option.objects.create(name='opt')
    option_collection = OptionCollection.objects.create(
        option_collection_hash='my_option_hash',
        option=option)
    platform = MachinePlatform.objects.create(
        os_name='win',
        platform='win7',
        architecture='x86',
        active_status='active')

    signature = PerformanceSignature.objects.create(
        repository=test_repository,
        signature_hash=(40*'t'),
        framework=framework,
        platform=platform,
        option_collection=option_collection,
        suite='mysuite',
        test='mytest'
    )

    INTERVAL = 30
    for (t, v) in zip([i for i in range(INTERVAL)],
                      ([0 for i in range(INTERVAL/2)] +
                       [1 for i in range(INTERVAL/2)])):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=0,
            signature=signature,
            push_timestamp=datetime.datetime.fromtimestamp(t),
            value=v)

    generate_new_alerts_in_series(signature)

    def verify_alert(alertid, expected_result_set_id,
                         expected_prev_result_set_id,
                         expected_signature, expected_initial_value,
                         expected_new_value):
        alert = PerformanceAlert.objects.get(id=alertid)
        assert alert.initial_value == expected_initial_value
        assert alert.new_value == expected_new_value
        assert alert.result_set_id == expected_result_set_id
        assert alert.series_signature == expected_signature

        summary = PerformanceAlertSummary.objects.get(id=alertid)
        assert summary.status == PerformanceAlertSummary.STATUSES[0][0]
        assert summary.result_set_id == expected_result_set_id
        assert summary.prev_result_set_id == expected_prev_result_set_id

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
    verify_alert(1, (INTERVAL/2), (INTERVAL/2)-1, signature, 0, 1)

    # verify that no new alerts generated if we rerun
    generate_new_alerts_in_series(signature)
    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
    verify_alert(1, (INTERVAL/2), (INTERVAL/2)-1, signature, 0, 1)

    # add data to generate a new alert
    for (t, v) in zip([i for i in range(INTERVAL, INTERVAL*2)],
                      [2 for i in range(INTERVAL)]):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=0,
            signature=signature,
            push_timestamp=datetime.datetime.fromtimestamp(t),
            value=v)

    generate_new_alerts_in_series(signature)

    assert PerformanceAlert.objects.count() == 2
    assert PerformanceAlertSummary.objects.count() == 2
    verify_alert(2, INTERVAL, INTERVAL-1, signature, 1, 2)
