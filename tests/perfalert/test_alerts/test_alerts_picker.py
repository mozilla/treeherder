from collections import Counter
from copy import deepcopy
from unittest.mock import Mock

import pytest

from treeherder.perf.alerts import AlertsPicker
from treeherder.perf.models import PerformanceAlert


@pytest.fixture
def test_many_various_alerts():
    alerts = [Mock(spec=PerformanceAlert) for i in range(10)]
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
        alert.series_signature.platform.platform = platforms[idx]
        alert.amount_pct = reversed_magnitudes[idx]
        toggle = not toggle
    return alerts


@pytest.fixture
def test_few_various_alerts():
    alerts = [Mock(spec=PerformanceAlert) for i in range(2)]
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
def test_few_regressions():
    alerts = [Mock(spec=PerformanceAlert) for i in range(5)]
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
    alerts = [Mock(spec=PerformanceAlert) for i in range(4)]
    platforms = (
        'rfvrtgb',
        '4.0',
        '54dcwec58',
        '8y6 t g',
    )
    for idx, alert in enumerate(alerts):
        alert.series_signature.platform.platform = platforms[idx]
    return alerts


def test_init():
    with pytest.raises(ValueError):
        AlertsPicker(
            max_alerts=0,
            max_improvements=2,
            platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
        )

    with pytest.raises(ValueError):
        AlertsPicker(
            max_alerts=3,
            max_improvements=0,
            platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
        )

    with pytest.raises(ValueError):
        AlertsPicker(max_alerts=3, max_improvements=5, platforms_of_interest=tuple())

    with pytest.raises(ValueError):
        AlertsPicker(max_alerts=0, max_improvements=0, platforms_of_interest=tuple())


def test_extract_important_alerts(
    test_bad_platform_names, test_few_improvements, test_few_regressions
):
    def count_alert_types(alerts):
        return Counter([alert.is_regression for alert in alerts])

    picker = AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )

    expected_platforms_order = (
        'windows10-64-shippable',
        'windows7-32-shippable',
        'linux64-shippable-qr',
        'osx-10-10-shippable',
        'windows10-64-shippable',
    )
    expected_magnitudes_order = (4, 3, 2, 1, 4)

    with pytest.raises(ValueError):
        picker.extract_important_alerts((Mock(), Mock()))

    important_alerts = picker.extract_important_alerts(
        test_bad_platform_names + test_few_improvements + test_few_regressions
    )

    number_of = count_alert_types(important_alerts)
    assert number_of[True] == 4
    assert number_of[False] == 1
    for idx, alert in enumerate(important_alerts):
        assert alert.series_signature.platform.platform == expected_platforms_order[idx]
        assert alert.amount_pct == expected_magnitudes_order[idx]


def test_ensure_alerts_variety(
    test_few_regressions, test_few_improvements, test_many_various_alerts, test_few_various_alerts
):
    def count_alert_types(alerts):
        return Counter([alert.is_regression for alert in alerts])

    picker = AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )

    selected_alerts = picker._ensure_alerts_variety(test_few_regressions)
    number_of = count_alert_types(selected_alerts)
    assert len(selected_alerts) == 5
    assert number_of[True] == 5

    selected_alerts = picker._ensure_alerts_variety(test_few_improvements)
    number_of = count_alert_types(selected_alerts)
    assert len(selected_alerts) == 2
    assert number_of[False] == 2

    selected_alerts = picker._ensure_alerts_variety(test_many_various_alerts)
    number_of = count_alert_types(selected_alerts)
    assert len(selected_alerts) == 5
    assert number_of[True] == 4
    assert number_of[False] == 1

    selected_alerts = picker._ensure_alerts_variety(test_few_various_alerts)
    number_of = count_alert_types(selected_alerts)
    assert len(selected_alerts) == 2
    assert number_of[True] == 1
    assert number_of[False] == 1

    picker = AlertsPicker(
        max_alerts=1,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )

    selected_alerts = picker._ensure_alerts_variety(test_few_various_alerts)
    number_of = count_alert_types(selected_alerts)
    assert len(selected_alerts) == 1
    assert number_of[True] == 1
    assert number_of[False] == 0


@pytest.mark.parametrize(
    ('max_alerts, expected_alerts_platforms'),
    [
        (5, ('windows10', 'windows7', 'linux', 'osx', 'android')),
        (8, ('windows10', 'windows7', 'linux', 'osx', 'android', 'windows10', 'windows7', 'linux')),
    ],
)
def test_ensure_platform_variety(test_many_various_alerts, max_alerts, expected_alerts_platforms):
    picker = AlertsPicker(
        max_alerts=max_alerts,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )

    picked_alerts = picker._ensure_platform_variety(test_many_various_alerts)
    for idx, platform in enumerate(expected_alerts_platforms):
        assert picked_alerts[idx].series_signature.platform.platform.startswith(platform)


def test_os_relevance():
    picker = AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )
    assert 5 == picker._os_relevance('windows10')
    assert 4 == picker._os_relevance('windows7')
    assert 3 == picker._os_relevance('linux')
    assert 2 == picker._os_relevance('osx')
    assert 1 == picker._os_relevance('android')

    with pytest.raises(ValueError):
        picker._os_relevance('some wierd OS')


def test_has_relevant_platform(test_many_various_alerts, test_bad_platform_names):
    picker = AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )

    for alert in test_many_various_alerts:
        assert picker._has_relevant_platform(alert) is True
    for alert in test_bad_platform_names:
        assert picker._has_relevant_platform(alert) is False


def test_extract_by_relevant_platforms(test_many_various_alerts, test_bad_platform_names):
    picker = AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )
    all_alerts = test_many_various_alerts + test_bad_platform_names

    relevant_alerts = picker._extract_by_relevant_platforms(all_alerts)
    assert set(relevant_alerts).intersection(set(all_alerts)) == set(relevant_alerts)
    assert set(relevant_alerts).intersection(set(test_bad_platform_names)) == set([])


def test_multi_criterion_sort(test_many_various_alerts):
    def count_alert_types(alerts):
        return Counter([alert.is_regression for alert in alerts])

    picker = AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )

    expected_platforms_order = (
        'windows10-64-shippable',
        'windows7-32-shippable',
        'linux64-shippable-qr',
        'osx-10-10-shippable',
        'android-hw-pix-7-1-android-aarch64',
        'windows10-64-shippable',
        'windows7-32-shippable',
        'linux64-shippable-qr',
        'osx-10-10-shippable',
        'android-hw-pix-7-1-android-aarch64',
    )
    expected_magnitudes_order = (9, 7, 5, 3, 1, 8, 6, 4, 2, 0)

    ordered_alerts = picker._multi_criterion_sort(reversed(test_many_various_alerts))
    number_of = count_alert_types(ordered_alerts)
    assert number_of[True] == 5
    assert number_of[False] == 5
    for idx, alert in enumerate(ordered_alerts):
        assert alert.series_signature.platform.platform == expected_platforms_order[idx]
        assert alert.amount_pct == expected_magnitudes_order[idx]
