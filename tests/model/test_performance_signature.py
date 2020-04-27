from treeherder.perf.models import PerformanceSignature


def test_performance_signatures_with_different_applications(test_perf_signature):
    assert PerformanceSignature.objects.count() == 1

    # create a performance signature that only differs from another existing one by the application name
    test_perf_signature.id = None
    test_perf_signature.application = 'chrome'
    test_perf_signature.save()

    assert PerformanceSignature.objects.count() == 2
