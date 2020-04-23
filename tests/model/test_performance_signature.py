from datetime import datetime

from treeherder.perf.models import PerformanceSignature


def test_performance_signatures_with_different_applications(test_perf_signature):
    assert PerformanceSignature.objects.count() == 1

    # create a performance signature that only differs from another existing one by the application name
    PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=test_perf_signature.signature_hash,
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite=test_perf_signature.suite,
        test=test_perf_signature.test,
        application='chrome',
        has_subtests=test_perf_signature.has_subtests,
        tags=test_perf_signature.tags,
        extra_options=test_perf_signature.extra_options,
        measurement_unit=test_perf_signature.measurement_unit,
        last_updated=datetime.now(),
    )

    assert PerformanceSignature.objects.count() == 2
