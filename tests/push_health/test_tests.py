from treeherder.model.models import Push
from treeherder.push_health.tests import get_test_failures


# Should get no unsupported, even though some FailureLines are just "log"
def test_get_current_failures_with_log(sample_push, test_job, failure_line_logs):
    push = Push.objects.first()
    test_job.result = 'testfailed'
    test_job.job_type.name = 'Special test of kindness'
    test_job.push = push
    test_job.save()

    test_failures = get_test_failures(push, [1, 2, 77])

    assert len(test_failures['needInvestigation']) == 2
    assert len(test_failures['unsupported']) == 0
