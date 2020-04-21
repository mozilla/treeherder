import pytest

from treeherder.push_health.classification import set_classifications


def test_intermittent_win7_reftest():
    """test that a failed test is classified as infra"""
    failures = [
        {
            'testName': 'foo',
            'failJobs': [],
            'jobName': 'Foodebug-reftest',
            'platform': 'windows7-32',
            'suggestedClassification': 'New Failure',
            'config': 'foo',
        }
    ]
    set_classifications(failures, {}, {})

    assert failures[0]['suggestedClassification'] == 'intermittent'


@pytest.mark.parametrize(
    ('history', 'confidence', 'classification', 'fcid'),
    [
        ({'foo': {'bing': {'baz': 2}}}, 100, 'intermittent', 1),
        ({'foo': {'bing': {'bee': 2}}}, 75, 'intermittent', 1),
        ({'foo': {'bee': {'bee': 2}}}, 50, 'intermittent', 1),
        ({'fee': {'bee': {'bee': 2}}}, 0, 'New Failure', 1),
        # no match, but job has been classified as intermittent by hand.
        ({'fee': {'bee': {'bee': 2}}}, 100, 'intermittent', 4),
    ],
)
def test_intermittent_confidence(history, confidence, classification, fcid):
    """test that a failed test is classified as intermittent, confidence 100"""
    failures = [
        {
            'testName': 'foo',
            'failJobs': [{'failure_classification_id': fcid}],
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
