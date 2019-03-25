import pytest

from treeherder.push_health.classification import set_classifications


def test_intermittent_win7_reftest():
    """test that a failed test is classified as infra"""
    failures = [
        {
            'testName': 'foo',
            'failureLines': [],
            'jobName': 'Foodebug-reftest',
            'platform': 'windows7-32',
            'suggestedClassification': 'New Failure',
            'config': 'foo',
        }
    ]
    set_classifications(failures, {}, {})

    assert failures[0]['suggestedClassification'] == 'intermittent'


@pytest.mark.parametrize(('history', 'confidence', 'classification'), [
    ({'foo': {'bing': {'baz': 2}}}, 100, 'intermittent'),
    ({'foo': {'bing': {'bee': 2}}}, 75, 'intermittent'),
    ({'foo': {'bee': {'bee': 2}}}, 50, 'intermittent'),
    ({'fee': {'bee': {'bee': 2}}}, 0, 'New Failure'),
])
def test_intermittent_confidence(history, confidence, classification):
    """test that a failed test is classified as intermittent, confidence 100"""
    failures = [
        {
            'testName': 'foo',
            'failureLines': [],
            'jobName': 'bar',
            'platform': 'bing',
            'suggestedClassification': 'New Failure',
            'config': 'baz',
            'confidence': 0,
        }
    ]

    set_classifications(failures, history, {})

    assert failures[0]['suggestedClassification'] == classification
    assert failures[0]['confidence'] == confidence
