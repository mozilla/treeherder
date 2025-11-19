import datetime
from unittest import skip

import pytest
from django.urls import reverse

from treeherder.model.models import Job
from treeherder.perf.models import PerformanceDatum, PerformanceDatumReplicate
from treeherder.webapp.api import perfcompare_utils

pytestmark = pytest.mark.perf

NOW = datetime.datetime.now()
ONE_DAY_AGO = NOW - datetime.timedelta(days=1)
FOUR_DAYS_AGO = NOW - datetime.timedelta(days=4)
SEVEN_DAYS_AGO = NOW - datetime.timedelta(days=7)


def test_perfcompare_results_against_no_base(
    client,
    create_signature,
    create_perf_datum,
    test_perf_signature,
    test_repository,
    try_repository,
    eleven_jobs_stored,
    test_perfcomp_push,
    test_perfcomp_push_2,
    test_linux_platform,
    test_option_collection,
):
    perf_jobs = Job.objects.filter(pk__in=range(1, 11)).order_by("push__time").all()

    test_perfcomp_push.time = FOUR_DAYS_AGO
    test_perfcomp_push.repository = try_repository
    test_perfcomp_push.save()
    test_perfcomp_push_2.time = datetime.datetime.now()
    test_perfcomp_push_2.save()

    suite = "a11yr"
    test = "dhtml.html"
    extra_options = "e10s fission stylo webrender"
    measurement_unit = "ms"
    base_application = "firefox"
    new_application = "firefox"

    base_sig = create_signature(
        signature_hash=(20 * "t1"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=try_repository,
        application=base_application,
    )

    base_perf_data_values = [32.4]
    new_perf_data_values = [40.2]

    job = perf_jobs[0]
    job.push = test_perfcomp_push
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=base_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=try_repository,
        signature=base_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()

    new_sig = create_signature(
        signature_hash=(20 * "t2"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
        application=new_application,
    )

    job = perf_jobs[1]
    job.push = test_perfcomp_push_2
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=new_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=job.repository,
        signature=new_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()

    response = get_expected(
        base_sig,
        new_sig,
        extra_options,
        test_option_collection,
        new_perf_data_values,
        base_perf_data_values,
    )

    expected = [
        {
            "base_rev": None,
            "new_rev": test_perfcomp_push_2.revision,
            "framework_id": base_sig.framework.id,
            "platform": base_sig.platform.platform,
            "suite": base_sig.suite,
            "header_name": response["header_name"],
            "base_repository_name": base_sig.repository.name,
            "new_repository_name": new_sig.repository.name,
            "base_app": base_sig.application,
            "new_app": new_sig.application,
            "is_complete": response["is_complete"],
            "base_measurement_unit": base_sig.measurement_unit,
            "new_measurement_unit": new_sig.measurement_unit,
            "base_retriggerable_job_ids": [4],
            "new_retriggerable_job_ids": [10],
            "base_runs": base_perf_data_values,
            "new_runs": new_perf_data_values,
            "base_runs_replicates": [32.4],
            "new_runs_replicates": [40.2],
            "base_avg_value": round(response["base_avg_value"], 2),
            "new_avg_value": round(response["new_avg_value"], 2),
            "base_median_value": round(response["base_median_value"], 2),
            "new_median_value": round(response["new_median_value"], 2),
            "test": base_sig.test,
            "option_name": response["option_name"],
            "extra_options": base_sig.extra_options,
            "base_stddev": round(response["base_stddev"], 2),
            "new_stddev": round(response["new_stddev"], 2),
            "base_stddev_pct": round(response["base_stddev_pct"], 2),
            "new_stddev_pct": round(response["new_stddev_pct"], 2),
            "confidence": round(response["confidence"], 2),
            "confidence_text": response["confidence_text"],
            "delta_value": round(response["delta_value"], 2),
            "delta_percentage": round(response["delta_pct"], 2),
            "magnitude": round(response["magnitude"], 2),
            "new_is_better": response["new_is_better"],
            "lower_is_better": response["lower_is_better"],
            "is_confident": response["is_confident"],
            "more_runs_are_needed": response["more_runs_are_needed"],
            "noise_metric": False,
            "graphs_link": f"https://treeherder.mozilla.org/perfherder/graphs?"
            f"highlightedRevisions={test_perfcomp_push_2.revision}&"
            f"series={try_repository.name}%2C{base_sig.signature_hash}%2C1%2C{base_sig.framework.id}&"
            f"series={test_repository.name}%2C{base_sig.signature_hash}%2C1%2C{base_sig.framework.id}&"
            f"timerange=86400",
            "is_improvement": response["is_improvement"],
            "is_regression": response["is_regression"],
            "is_meaningful": response["is_meaningful"],
            "base_parent_signature": response["base_parent_signature"],
            "new_parent_signature": response["new_parent_signature"],
            "base_signature_id": response["base_signature_id"],
            "new_signature_id": response["new_signature_id"],
            "has_subtests": response["has_subtests"],
        },
    ]

    query_params = (
        "?base_repository={}&new_repository={}&new_revision={}&framework={"
        "}&interval={}&no_subtests=true".format(
            try_repository.name,
            test_repository.name,
            test_perfcomp_push_2.revision,
            test_perf_signature.framework_id,
            604800,  # seven days in milliseconds
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)

    assert response.status_code == 200
    assert expected[0] == response.json()[0]
    assert response.json()[0]["base_parent_signature"] is None
    assert response.json()[0]["new_parent_signature"] is None


def test_perfcompare_results_with_only_one_run_and_diff_repo(
    client,
    create_signature,
    create_perf_datum,
    test_perf_signature,
    test_repository,
    try_repository,
    eleven_jobs_stored,
    test_perfcomp_push,
    test_perfcomp_push_2,
    test_linux_platform,
    test_option_collection,
):
    perf_jobs = Job.objects.filter(pk__in=range(1, 11)).order_by("push__time").all()

    test_perfcomp_push.time = FOUR_DAYS_AGO
    test_perfcomp_push.repository = try_repository
    test_perfcomp_push.save()
    test_perfcomp_push_2.time = datetime.datetime.now()
    test_perfcomp_push_2.save()

    suite = "a11yr"
    test = "dhtml.html"
    extra_options = "e10s fission stylo webrender"
    measurement_unit = "ms"
    base_application = "firefox"
    new_application = "firefox"

    base_sig = create_signature(
        signature_hash=(20 * "t1"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=try_repository,
        application=base_application,
    )

    base_perf_data_values = [32.4]
    new_perf_data_values = [40.2]
    base_perf_data_replicates = [20]
    new_perf_data_replicates = [15]

    job = perf_jobs[0]
    job.push = test_perfcomp_push
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=base_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=try_repository,
        signature=base_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()
    PerformanceDatumReplicate.objects.create(performance_datum=perf_datum, value=20)

    new_sig = create_signature(
        signature_hash=(20 * "t2"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
        application=new_application,
    )

    job = perf_jobs[1]
    job.push = test_perfcomp_push_2
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=new_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=job.repository,
        signature=new_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()
    PerformanceDatumReplicate.objects.create(performance_datum=perf_datum, value=15)

    response = get_expected(
        base_sig,
        new_sig,
        extra_options,
        test_option_collection,
        new_perf_data_values,
        base_perf_data_values,
    )

    expected = [
        {
            "base_rev": test_perfcomp_push.revision,
            "new_rev": test_perfcomp_push_2.revision,
            "framework_id": base_sig.framework.id,
            "platform": base_sig.platform.platform,
            "suite": base_sig.suite,
            "header_name": response["header_name"],
            "base_repository_name": base_sig.repository.name,
            "new_repository_name": new_sig.repository.name,
            "base_app": base_sig.application,
            "new_app": new_sig.application,
            "is_complete": response["is_complete"],
            "base_measurement_unit": base_sig.measurement_unit,
            "new_measurement_unit": new_sig.measurement_unit,
            "base_retriggerable_job_ids": [4],
            "new_retriggerable_job_ids": [10],
            "base_runs": base_perf_data_values,
            "new_runs": new_perf_data_values,
            "base_runs_replicates": [20],
            "new_runs_replicates": [15],
            "base_avg_value": round(response["base_avg_value"], 2),
            "new_avg_value": round(response["new_avg_value"], 2),
            "base_median_value": round(response["base_median_value"], 2),
            "new_median_value": round(response["new_median_value"], 2),
            "test": base_sig.test,
            "option_name": response["option_name"],
            "extra_options": base_sig.extra_options,
            "base_stddev": round(response["base_stddev"], 2),
            "new_stddev": round(response["new_stddev"], 2),
            "base_stddev_pct": round(response["base_stddev_pct"], 2),
            "new_stddev_pct": round(response["new_stddev_pct"], 2),
            "confidence": round(response["confidence"], 2),
            "confidence_text": response["confidence_text"],
            "delta_value": round(response["delta_value"], 2),
            "delta_percentage": round(response["delta_pct"], 2),
            "magnitude": round(response["magnitude"], 2),
            "new_is_better": response["new_is_better"],
            "lower_is_better": response["lower_is_better"],
            "is_confident": response["is_confident"],
            "more_runs_are_needed": response["more_runs_are_needed"],
            "noise_metric": False,
            "graphs_link": f"https://treeherder.mozilla.org/perfherder/graphs?highlightedRevisions={test_perfcomp_push.revision}&"
            f"highlightedRevisions={test_perfcomp_push_2.revision}&"
            f"series={try_repository.name}%2C{base_sig.signature_hash}%2C1%2C{base_sig.framework.id}&"
            f"series={test_repository.name}%2C{base_sig.signature_hash}%2C1%2C{base_sig.framework.id}&"
            f"timerange=604800",
            "is_improvement": response["is_improvement"],
            "is_regression": response["is_regression"],
            "is_meaningful": response["is_meaningful"],
            "base_parent_signature": response["base_parent_signature"],
            "new_parent_signature": response["new_parent_signature"],
            "base_signature_id": response["base_signature_id"],
            "new_signature_id": response["new_signature_id"],
            "has_subtests": response["has_subtests"],
        },
    ]

    query_params = (
        "?base_repository={}&new_repository={}&base_revision={}&new_revision={}&framework={"
        "}&no_subtests=true".format(
            try_repository.name,
            test_repository.name,
            test_perfcomp_push.revision,
            test_perfcomp_push_2.revision,
            test_perf_signature.framework_id,
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)

    assert response.status_code == 200
    assert expected[0] == response.json()[0]

    # test the same comparison by setting the replicates values to true
    query_params = (
        "?base_repository={}&new_repository={}&base_revision={}&new_revision={}&framework={"
        "}&no_subtests=true&replicates=true".format(
            try_repository.name,
            test_repository.name,
            test_perfcomp_push.revision,
            test_perfcomp_push_2.revision,
            test_perf_signature.framework_id,
        )
    )

    expected_response = get_expected(
        base_sig,
        new_sig,
        extra_options,
        test_option_collection,
        # get expected_response using the replicates values
        new_perf_data_replicates,
        base_perf_data_replicates,
    )
    response = client.get(reverse("perfcompare-results") + query_params)

    # test to see how the response changed based on the replicates values
    assert response.status_code == 200
    response.json()[0]["base_avg_value"] = round(expected_response["base_avg_value"], 2)
    response.json()[0]["base_stddev"] = round(expected_response["base_stddev"], 2)
    response.json()[0]["base_median_value"] = round(expected_response["base_median_value"], 2)
    response.json()[0]["new_avg_value"] = round(expected_response["new_avg_value"], 2)
    response.json()[0]["new_stddev"] = round(expected_response["new_stddev"], 2)
    response.json()[0]["new_median_value"] = round(expected_response["new_median_value"], 2)


def test_perfcompare_results_without_base_signature(
    client,
    create_signature,
    create_perf_datum,
    test_perf_signature,
    test_repository,
    try_repository,
    eleven_jobs_stored,
    test_perfcomp_push,
    test_perfcomp_push_2,
    test_linux_platform,
    test_option_collection,
):
    perf_jobs = Job.objects.filter(pk__in=range(1, 11)).order_by("push__time").all()

    test_perfcomp_push.time = FOUR_DAYS_AGO
    test_perfcomp_push.repository = try_repository
    test_perfcomp_push.save()

    test_perfcomp_push_2.time = datetime.datetime.now()
    test_perfcomp_push_2.save()

    suite = "a11yr"
    test = "dhtml.html"
    extra_options = "e10s fission stylo webrender"
    measurement_unit = "ms"
    new_application = "geckoview"

    new_perf_data_values = [40.2]

    new_sig = create_signature(
        signature_hash=(20 * "t2"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
        application=new_application,
    )

    job = perf_jobs[1]
    job.push = test_perfcomp_push_2
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=new_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=job.repository,
        signature=new_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()

    response = get_expected(
        None,
        new_sig,
        extra_options,
        test_option_collection,
        new_perf_data_values,
        [],
    )

    expected = [
        {
            "base_rev": test_perfcomp_push.revision,
            "new_rev": test_perfcomp_push_2.revision,
            "framework_id": new_sig.framework.id,
            "platform": new_sig.platform.platform,
            "suite": new_sig.suite,
            "header_name": response["header_name"],
            "base_repository_name": try_repository.name,
            "new_repository_name": new_sig.repository.name,
            "base_app": "",
            "new_app": "geckoview",
            "is_complete": False,
            "base_measurement_unit": "",
            "new_measurement_unit": new_sig.measurement_unit,
            "base_retriggerable_job_ids": [],
            "new_retriggerable_job_ids": [job.id],
            "base_runs": [],
            "new_runs": new_perf_data_values,
            "base_runs_replicates": [],
            "new_runs_replicates": [40.2],
            "base_avg_value": round(response["base_avg_value"], 2),
            "new_avg_value": round(response["new_avg_value"], 2),
            "base_median_value": round(response["base_median_value"], 2),
            "new_median_value": round(response["new_median_value"], 2),
            "test": new_sig.test,
            "option_name": response["option_name"],
            "extra_options": new_sig.extra_options,
            "base_stddev": round(response["base_stddev"], 2),
            "new_stddev": round(response["new_stddev"], 2),
            "base_stddev_pct": round(response["base_stddev_pct"], 2),
            "new_stddev_pct": round(response["new_stddev_pct"], 2),
            "confidence": round(response["confidence"], 2),
            "confidence_text": response["confidence_text"],
            "delta_value": round(response["delta_value"], 2),
            "delta_percentage": round(response["delta_pct"], 2),
            "magnitude": round(response["magnitude"], 2),
            "new_is_better": response["new_is_better"],
            "lower_is_better": response["lower_is_better"],
            "is_confident": response["is_confident"],
            "more_runs_are_needed": False,
            "noise_metric": False,
            "graphs_link": f"https://treeherder.mozilla.org/perfherder/graphs?highlightedRevisions={test_perfcomp_push.revision}&"
            f"highlightedRevisions={test_perfcomp_push_2.revision}&"
            f"series={try_repository.name}%2C{new_sig.signature_hash}%2C1%2C{new_sig.framework.id}&"
            f"series={test_repository.name}%2C{new_sig.signature_hash}%2C1%2C{new_sig.framework.id}&"
            f"timerange=604800",
            "is_improvement": response["is_improvement"],
            "is_regression": response["is_regression"],
            "is_meaningful": response["is_meaningful"],
            "base_parent_signature": response["base_parent_signature"],
            "new_parent_signature": response["new_parent_signature"],
            "base_signature_id": response["base_signature_id"],
            "new_signature_id": response["new_signature_id"],
            "has_subtests": response["has_subtests"],
        },
    ]

    query_params = (
        "?base_repository={}&new_repository={}&base_revision={}&new_revision={}&framework={"
        "}&no_subtests=true".format(
            try_repository.name,
            test_repository.name,
            test_perfcomp_push.revision,
            test_perfcomp_push_2.revision,
            test_perf_signature.framework_id,
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)

    assert response.status_code == 200
    assert expected[0] == response.json()[0]


def test_perfcompare_results_subtests_support(
    client,
    create_signature,
    create_perf_datum,
    test_perf_signature,
    test_perf_signature_2,
    test_repository,
    try_repository,
    eleven_jobs_stored,
    test_perfcomp_push,
    test_perfcomp_push_2,
    test_linux_platform,
    test_option_collection,
):
    perf_jobs = Job.objects.filter(pk__in=range(1, 11)).order_by("push__time").all()

    test_perfcomp_push.time = FOUR_DAYS_AGO
    test_perfcomp_push.repository = try_repository
    test_perfcomp_push.save()
    test_perfcomp_push_2.time = datetime.datetime.now()
    test_perfcomp_push_2.save()

    suite = "a11yr"
    test = "dhtml.html"
    extra_options = "e10s fission stylo webrender"
    measurement_unit = "ms"
    base_application = "firefox"
    new_application = "firefox"

    base_sig = create_signature(
        signature_hash=(20 * "t1"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=try_repository,
        application=base_application,
    )
    base_sig.parent_signature = test_perf_signature_2
    base_sig.save()

    base_perf_data_values = [32.4]
    new_perf_data_values = [40.2]

    job = perf_jobs[0]
    job.push = test_perfcomp_push
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=base_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=try_repository,
        signature=base_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()

    new_sig = create_signature(
        signature_hash=(20 * "t2"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
        application=new_application,
    )
    new_sig.parent_signature = test_perf_signature_2
    new_sig.save()

    job = perf_jobs[1]
    job.push = test_perfcomp_push_2
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=new_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=job.repository,
        signature=new_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()

    response = get_expected(
        base_sig,
        new_sig,
        extra_options,
        test_option_collection,
        new_perf_data_values,
        base_perf_data_values,
    )

    expected = [
        {
            "base_rev": test_perfcomp_push.revision,
            "new_rev": test_perfcomp_push_2.revision,
            "framework_id": base_sig.framework.id,
            "platform": base_sig.platform.platform,
            "suite": base_sig.suite,
            "header_name": response["header_name"],
            "base_repository_name": base_sig.repository.name,
            "new_repository_name": new_sig.repository.name,
            "base_app": base_sig.application,
            "new_app": new_sig.application,
            "is_complete": response["is_complete"],
            "base_measurement_unit": base_sig.measurement_unit,
            "new_measurement_unit": new_sig.measurement_unit,
            "base_retriggerable_job_ids": [4],
            "new_retriggerable_job_ids": [10],
            "base_runs": base_perf_data_values,
            "new_runs": new_perf_data_values,
            "base_runs_replicates": [32.4],
            "new_runs_replicates": [40.2],
            "base_avg_value": round(response["base_avg_value"], 2),
            "new_avg_value": round(response["new_avg_value"], 2),
            "base_median_value": round(response["base_median_value"], 2),
            "new_median_value": round(response["new_median_value"], 2),
            "test": base_sig.test,
            "option_name": response["option_name"],
            "extra_options": base_sig.extra_options,
            "base_stddev": round(response["base_stddev"], 2),
            "new_stddev": round(response["new_stddev"], 2),
            "base_stddev_pct": round(response["base_stddev_pct"], 2),
            "new_stddev_pct": round(response["new_stddev_pct"], 2),
            "confidence": round(response["confidence"], 2),
            "confidence_text": response["confidence_text"],
            "delta_value": round(response["delta_value"], 2),
            "delta_percentage": round(response["delta_pct"], 2),
            "magnitude": round(response["magnitude"], 1),
            "new_is_better": response["new_is_better"],
            "lower_is_better": response["lower_is_better"],
            "is_confident": response["is_confident"],
            "more_runs_are_needed": response["more_runs_are_needed"],
            "noise_metric": False,
            "graphs_link": f"https://treeherder.mozilla.org/perfherder/graphs?highlightedRevisions={test_perfcomp_push.revision}&"
            f"highlightedRevisions={test_perfcomp_push_2.revision}&"
            f"series={try_repository.name}%2C{base_sig.signature_hash}%2C1%2C{base_sig.framework.id}&"
            f"series={test_repository.name}%2C{base_sig.signature_hash}%2C1%2C{base_sig.framework.id}&"
            f"timerange=604800",
            "is_improvement": response["is_improvement"],
            "is_regression": response["is_regression"],
            "is_meaningful": response["is_meaningful"],
            "base_parent_signature": response["base_parent_signature"],
            "new_parent_signature": response["new_parent_signature"],
            "base_signature_id": response["base_signature_id"],
            "new_signature_id": response["new_signature_id"],
            "has_subtests": response["has_subtests"],
        },
    ]

    query_params = (
        "?base_repository={}&new_repository={}&base_revision={}&new_revision={}&framework={"
        "}&base_parent_signature={}".format(
            try_repository.name,
            test_repository.name,
            test_perfcomp_push.revision,
            test_perfcomp_push_2.revision,
            test_perf_signature.framework_id,
            test_perf_signature_2.id,
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)

    assert response.status_code == 200
    assert expected[0] == response.json()[0]
    assert response.json()[0]["base_parent_signature"] == test_perf_signature_2.id
    assert response.json()[0]["new_parent_signature"] == test_perf_signature_2.id


@skip("test is frequently failing in CI, needs to be fixed, see bug 1809467")
def test_perfcompare_results_multiple_runs(
    client,
    create_signature,
    create_perf_datum,
    test_perf_signature,
    test_repository,
    eleven_jobs_stored,
    test_perfcomp_push,
    test_perfcomp_push_2,
    test_linux_platform,
    test_macosx_platform,
    test_option_collection,
):
    perf_jobs = Job.objects.filter(pk__in=range(1, 11)).order_by("push__time").all()

    test_perfcomp_push.time = SEVEN_DAYS_AGO
    test_perfcomp_push.save()
    test_perfcomp_push_2.time = datetime.datetime.now(test_perfcomp_push_2.save())

    suite = "a11yr"
    test = "dhtml.html"
    extra_options = "e10s fission stylo webrender"
    measurement_unit = "ms"

    sig1 = create_signature(
        signature_hash=(20 * "t1"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
    )

    sig1_val = [21.23, 32.4, 55.1]
    sig2_val = [36.2, 40.0]
    sig3_val = [60.0, 70.7]
    sig4_val = [55.0, 70.0]

    for index, job in enumerate(perf_jobs[:3]):
        create_perf_datum(index, job, test_perfcomp_push, sig1, sig1_val)

    sig2 = create_signature(
        signature_hash=(20 * "t2"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
    )

    for index, job in enumerate(perf_jobs[3:5]):
        create_perf_datum(index, job, test_perfcomp_push_2, sig2, sig2_val)

    sig3 = create_signature(
        signature_hash=(20 * "t3"),
        extra_options=extra_options,
        platform=test_macosx_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
    )

    for index, job in enumerate(perf_jobs[5:7]):
        create_perf_datum(index, job, test_perfcomp_push, sig3, sig3_val)

    sig4 = create_signature(
        signature_hash=(20 * "t4"),
        extra_options=extra_options,
        platform=test_macosx_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
    )

    for index, job in enumerate(perf_jobs[7:9]):
        create_perf_datum(index, job, test_perfcomp_push_2, sig4, sig4_val)

    first_row = get_expected(sig1, extra_options, test_option_collection, sig2_val, sig1_val)

    second_row = get_expected(sig3, extra_options, test_option_collection, sig4_val, sig3_val)

    expected = [
        {
            "base_rev": test_perfcomp_push.revision,
            "new_rev": test_perfcomp_push_2.revision,
            "framework_id": sig1.framework.id,
            "platform": sig1.platform.platform,
            "suite": sig1.suite,
            "header_name": first_row["header_name"],
            "base_repository_name": sig1.repository.name,
            "new_repository_name": sig2.repository.name,
            "base_app": "",
            "new_app": "",
            "is_complete": first_row["is_complete"],
            "base_measurement_unit": sig1.measurement_unit,
            "new_measurement_unit": sig2.measurement_unit,
            "base_retriggerable_job_ids": [1, 2, 4],
            "new_retriggerable_job_ids": [7, 8],
            "base_runs": sig1_val,
            "new_runs": sig2_val,
            "base_runs_replicates": [],
            "new_runs_replicates": [],
            "base_avg_value": round(first_row["base_avg_value"], 2),
            "new_avg_value": round(first_row["new_avg_value"], 2),
            "base_median_value": round(first_row["base_median_value"], 2),
            "new_median_value": round(first_row["new_median_value"], 2),
            "test": sig1.test,
            "option_name": first_row["option_name"],
            "extra_options": sig1.extra_options,
            "base_stddev": round(first_row["base_stddev"], 2),
            "new_stddev": round(first_row["new_stddev"], 2),
            "base_stddev_pct": round(first_row["base_stddev_pct"], 2),
            "new_stddev_pct": round(first_row["new_stddev_pct"], 2),
            "confidence": round(first_row["confidence"], 2),
            "confidence_text": first_row["confidence_text"],
            "delta_value": round(first_row["delta_value"], 2),
            "delta_percentage": round(first_row["delta_pct"], 2),
            "magnitude": round(first_row["magnitude"], 2),
            "new_is_better": first_row["new_is_better"],
            "lower_is_better": first_row["lower_is_better"],
            "is_confident": first_row["is_confident"],
            "more_runs_are_needed": first_row["more_runs_are_needed"],
            "noise_metric": False,
            "graphs_link": f"https://treeherder.mozilla.org/perfherder/graphs?highlightedRevisions={test_perfcomp_push.revision}&"
            f"highlightedRevisions={test_perfcomp_push_2.revision}&"
            f"series={test_repository.name}%2C{sig1.signature_hash}%2C1%2C{sig1.framework.id}&timerange=1209600",
            "is_improvement": first_row["is_improvement"],
            "is_regression": first_row["is_regression"],
            "is_meaningful": first_row["is_meaningful"],
        },
        {
            "base_rev": test_perfcomp_push.revision,
            "new_rev": test_perfcomp_push_2.revision,
            "framework_id": sig3.framework.id,
            "platform": sig3.platform.platform,
            "suite": sig3.suite,
            "header_name": second_row["header_name"],
            "base_repository_name": sig3.repository.name,
            "new_repository_name": sig4.repository.name,
            "base_app": "",
            "new_app": "",
            "is_complete": second_row["is_complete"],
            "base_measurement_unit": sig3.measurement_unit,
            "new_measurement_unit": sig4.measurement_unit,
            "base_retriggerable_job_ids": [1, 2],
            "new_retriggerable_job_ids": [4, 7],
            "base_runs": sig3_val,
            "new_runs": sig4_val,
            "base_runs_replicates": [],
            "new_runs_replicates": [],
            "base_avg_value": round(second_row["base_avg_value"], 2),
            "new_avg_value": round(second_row["new_avg_value"], 2),
            "base_median_value": round(second_row["base_median_value"], 2),
            "new_median_value": round(second_row["new_median_value"], 2),
            "test": sig3.test,
            "option_name": second_row["option_name"],
            "extra_options": sig3.extra_options,
            "base_stddev": round(second_row["base_stddev"], 2),
            "new_stddev": round(second_row["new_stddev"], 2),
            "base_stddev_pct": round(second_row["base_stddev_pct"], 2),
            "new_stddev_pct": round(second_row["new_stddev_pct"], 2),
            "confidence": round(second_row["confidence"], 2),
            "confidence_text": second_row["confidence_text"],
            "delta_value": round(second_row["delta_value"], 2),
            "delta_percentage": round(second_row["delta_pct"], 2),
            "magnitude": round(second_row["magnitude"], 2),
            "new_is_better": second_row["new_is_better"],
            "lower_is_better": second_row["lower_is_better"],
            "is_confident": second_row["is_confident"],
            "more_runs_are_needed": second_row["more_runs_are_needed"],
            "noise_metric": False,
            "graphs_link": f"https://treeherder.mozilla.org/perfherder/graphs?highlightedRevisions={test_perfcomp_push.revision}&"
            f"highlightedRevisions={test_perfcomp_push_2.revision}&"
            f"series={test_repository.name}%2C{sig3.signature_hash}%2C1%2C{sig1.framework.id}&timerange=1209600",
            "is_improvement": second_row["is_improvement"],
            "is_regression": second_row["is_regression"],
            "is_meaningful": second_row["is_meaningful"],
        },
    ]

    query_params = (
        "?base_repository={}&new_repository={}&base_revision={}&new_revision={}&framework={"
        "}&no_subtests=true".format(
            test_perf_signature.repository.name,
            test_perf_signature.repository.name,
            test_perfcomp_push.revision,
            test_perfcomp_push_2.revision,
            test_perf_signature.framework_id,
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)
    assert response.status_code == 200
    for result in expected:
        assert result in response.json()


def test_revision_is_not_found(client, test_perf_signature, test_perfcomp_push):
    non_existent_revision = "nonexistentrevision"
    query_params = (
        "?base_repository={}&new_repository={}&base_revision={}&new_revision={}&framework={"
        "}&no_subtests=true".format(
            test_perf_signature.repository.name,
            test_perf_signature.repository.name,
            non_existent_revision,
            test_perfcomp_push.revision,
            test_perf_signature.framework_id,
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)
    assert response.status_code == 400
    assert (
        response.json()
        == f"No base push with revision {non_existent_revision} from repo {test_perf_signature.repository.name}."
    )

    query_params = (
        "?base_repository={}&new_repository={}&base_revision={}&new_revision={}&framework={"
        "}&no_subtests=true".format(
            test_perf_signature.repository.name,
            test_perf_signature.repository.name,
            test_perfcomp_push.revision,
            non_existent_revision,
            test_perf_signature.framework_id,
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)
    assert response.status_code == 400
    assert (
        response.json()
        == f"No new push with revision {non_existent_revision} from repo {test_perf_signature.repository.name}."
    )


def test_interval_is_required_when_comparing_without_base(
    client, test_perf_signature, test_perfcomp_push
):
    non_existent_revision = "nonexistentrevision"
    query_params = (
        "?base_repository={}&new_repository={}&new_revision={}&framework={"
        "}&no_subtests=true".format(
            test_perf_signature.repository.name,
            test_perf_signature.repository.name,
            non_existent_revision,
            test_perf_signature.framework_id,
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)
    assert response.status_code == 400
    assert response.json() == {"non_field_errors": ["Field required: interval."]}


def get_expected(
    base_sig,
    new_sig,
    extra_options,
    test_option_collection,
    new_perf_data_values,
    base_perf_data_values,
):
    sig = base_sig if base_sig else new_sig
    response = {"option_name": test_option_collection.get(sig.option_collection_id, "")}
    test_suite = perfcompare_utils.get_test_suite(sig.suite, sig.test)
    response["header_name"] = perfcompare_utils.get_header_name(
        extra_options, response["option_name"], test_suite, sig.application
    )
    response["base_avg_value"] = perfcompare_utils.get_avg(
        base_perf_data_values, response["header_name"]
    )
    response["new_avg_value"] = perfcompare_utils.get_avg(
        new_perf_data_values, response["header_name"]
    )
    response["base_median_value"] = perfcompare_utils.get_median(base_perf_data_values)
    response["new_median_value"] = perfcompare_utils.get_median(new_perf_data_values)
    response["delta_value"] = perfcompare_utils.get_delta_value(
        response["new_avg_value"], response.get("base_avg_value")
    )
    response["delta_pct"] = perfcompare_utils.get_delta_percentage(
        response["delta_value"], response["base_avg_value"]
    )
    response["base_stddev"] = perfcompare_utils.get_stddev(
        base_perf_data_values, response["header_name"]
    )
    response["new_stddev"] = perfcompare_utils.get_stddev(
        new_perf_data_values, response["header_name"]
    )
    response["base_stddev_pct"] = perfcompare_utils.get_stddev_pct(
        response["base_avg_value"], response["base_stddev"]
    )
    response["new_stddev_pct"] = perfcompare_utils.get_stddev_pct(
        response["new_avg_value"], response["new_stddev"]
    )
    response["magnitude"] = perfcompare_utils.get_magnitude(response["delta_pct"])
    response["new_is_better"] = perfcompare_utils.is_new_better(
        response["delta_value"], sig.lower_is_better
    )
    response["lower_is_better"] = sig.lower_is_better
    response["confidence"] = perfcompare_utils.get_abs_ttest_value(
        base_perf_data_values, new_perf_data_values
    )
    response["is_confident"] = perfcompare_utils.is_confident(
        len(base_perf_data_values), len(new_perf_data_values), response["confidence"]
    )
    response["confidence_text"] = perfcompare_utils.get_confidence_text(response["confidence"])
    response["is_complete"] = True
    response["more_runs_are_needed"] = perfcompare_utils.more_runs_are_needed(
        response["is_complete"], response["is_confident"], len(base_perf_data_values)
    )
    class_name = perfcompare_utils.get_class_name(
        response["new_is_better"],
        response["base_avg_value"],
        response["new_avg_value"],
        response["confidence"],
    )
    response["is_improvement"] = class_name == "success"
    response["is_regression"] = class_name == "danger"
    response["is_meaningful"] = class_name == ""
    response["base_parent_signature"] = (
        base_sig.parent_signature.id if base_sig and base_sig.parent_signature else None
    )
    response["new_parent_signature"] = (
        new_sig.parent_signature.id if new_sig and new_sig.parent_signature else None
    )
    response["base_signature_id"] = base_sig.id if base_sig else None
    response["new_signature_id"] = new_sig.id if new_sig else None
    response["has_subtests"] = (base_sig.has_subtests if base_sig else False) or (
        new_sig.has_subtests if new_sig else False
    )
    return response


def test_perfcompare_results_with_mann_witney_u_against_no_base(
    client,
    create_signature,
    create_perf_datum,
    test_perf_signature,
    test_repository,
    try_repository,
    eleven_jobs_stored,
    test_perfcomp_push,
    test_perfcomp_push_2,
    test_linux_platform,
    test_option_collection,
):
    perf_jobs = Job.objects.filter(pk__in=range(1, 11)).order_by("push__time").all()

    test_perfcomp_push.time = FOUR_DAYS_AGO
    test_perfcomp_push.repository = try_repository
    test_perfcomp_push.save()
    test_perfcomp_push_2.time = datetime.datetime.now()
    test_perfcomp_push_2.save()

    suite = "a11yr"
    test = "dhtml.html"
    extra_options = "e10s fission stylo webrender"
    measurement_unit = "ms"
    base_application = "firefox"
    new_application = "firefox"

    base_sig = create_signature(
        signature_hash=(20 * "t1"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=try_repository,
        application=base_application,
    )

    base_perf_data_values = [32.4]
    new_perf_data_values = [40.2]

    job = perf_jobs[0]
    job.push = test_perfcomp_push
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=base_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=try_repository,
        signature=base_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()

    new_sig = create_signature(
        signature_hash=(20 * "t2"),
        extra_options=extra_options,
        platform=test_linux_platform,
        measurement_unit=measurement_unit,
        suite=suite,
        test=test,
        test_perf_signature=test_perf_signature,
        repository=test_repository,
        application=new_application,
    )

    job = perf_jobs[1]
    job.push = test_perfcomp_push_2
    job.save()
    perf_datum = PerformanceDatum.objects.create(
        value=new_perf_data_values[0],
        push_timestamp=job.push.time,
        job=job,
        push=job.push,
        repository=job.repository,
        signature=new_sig,
    )
    perf_datum.push.time = job.push.time
    perf_datum.push.save()

    response = get_expected(
        base_sig,
        new_sig,
        extra_options,
        test_option_collection,
        new_perf_data_values,
        base_perf_data_values,
    )

    expected = [
        {
            "base_rev": None,
            "new_rev": test_perfcomp_push_2.revision,
            "framework_id": base_sig.framework.id,
            "platform": base_sig.platform.platform,
            "suite": base_sig.suite,
            "header_name": response["header_name"],
            "base_repository_name": base_sig.repository.name,
            "new_repository_name": new_sig.repository.name,
            "base_app": base_sig.application,
            "new_app": new_sig.application,
            "is_complete": response["is_complete"],
            "base_measurement_unit": base_sig.measurement_unit,
            "new_measurement_unit": new_sig.measurement_unit,
            "base_retriggerable_job_ids": [4],
            "new_retriggerable_job_ids": [10],
            "base_runs": base_perf_data_values,
            "new_runs": new_perf_data_values,
            "base_runs_replicates": [32.4],
            "new_runs_replicates": [40.2],
            "test": base_sig.test,
            "option_name": response["option_name"],
            "extra_options": base_sig.extra_options,
            "delta_value": round(response["delta_value"], 2),
            "delta_percentage": round(response["delta_pct"], 2),
            "lower_is_better": response["lower_is_better"],
            "is_confident": response["is_confident"],
            "more_runs_are_needed": False,
            "mann_whitney_test": {
                "interpretation": "not significant",
                "pvalue": 1.0,
                "stat": None,
                "test_name": "Mann-Whitney U",
            },
            "graphs_link": f"https://treeherder.mozilla.org/perfherder/graphs?"
            f"highlightedRevisions={test_perfcomp_push_2.revision}&"
            f"series={try_repository.name}%2C{base_sig.signature_hash}%2C1%2C{base_sig.framework.id}&"
            f"series={test_repository.name}%2C{base_sig.signature_hash}%2C1%2C{base_sig.framework.id}&"
            f"timerange=86400",
            "is_fit_good": True,
            "is_improvement": None,
            "is_regression": None,
            "is_meaningful": True,
            "is_new_better": None,
            "base_parent_signature": response["base_parent_signature"],
            "new_parent_signature": response["new_parent_signature"],
            "base_signature_id": response["base_signature_id"],
            "new_signature_id": response["new_signature_id"],
            "has_subtests": response["has_subtests"],
            "cles": None,
            "cliffs_delta": -1.0,
            "cliffs_interpretation": "large",
            "direction_of_change": "no change",
            "base_standard_stats": {
                "count": 1,
                "max": 32.4,
                "mean": round(response["base_avg_value"], 2),
                "median": round(response["base_median_value"], 2),
                "min": 32.4,
                "stddev": 0.0,
                "stddev_pct": 0.0,
                "variance": 0.0,
            },
            "new_standard_stats": {
                "count": 1,
                "max": 40.2,
                "mean": round(response["new_avg_value"], 2),
                "median": round(response["new_median_value"], 2),
                "min": 40.2,
                "stddev": 0.0,
                "stddev_pct": 0.0,
                "variance": 0.0,
            },
            "kde_base": {
                "kde_x": [
                    32.4,
                ],
                "kde_y": [],
                "median": 32.4,
                "sample_count": 1,
            },
            "kde_new": {
                "kde_x": [
                    40.2,
                ],
                "kde_y": [],
                "median": 40.2,
                "sample_count": 1,
            },
            "kde_warnings": [
                "Less than 2 datapoints or no standard variance for a meaningful fit "
                "Kernel Density Estimator (KDE) with an ISJ bandwidth to Base.",
                "Less than 2 datapoints or no standard variance for a meaningful fit "
                "Kernel Density Estimator (KDE) with an ISJ bandwidth to New.",
            ],
            "ks_test": {
                "interpretation": "KS test p-value: 1.000, good fit",
                "pvalue": 1.0,
                "stat": 1.0,
                "test_name": "Kolmogorov-Smirnov",
            },
            "ks_warning": None,
            "shapiro_wilk_test_base": {
                "interpretation": "Not enough data for normality test.",
                "pvalue": None,
                "stat": None,
                "test_name": "Shapiro-Wilk",
            },
            "shapiro_wilk_test_new": {
                "interpretation": "Not enough data for normality test",
                "pvalue": None,
                "stat": None,
                "test_name": "Shapiro-Wilk",
            },
            "shapiro_wilk_warnings": [
                "Shapiro-Wilk test cannot be run on Base with fewer than 3 data points.",
                "Shapiro-Wilk test cannot be run on New with fewer than 3 data points.",
            ],
            "silverman_kde": {
                "bandwidth": "Silverman",
                "base_locations": [32.4],
                "base_mode_count": 1,
                "base_prominence": 0.08,
                "is_improvement": None,
                "is_regression": None,
                "modes": [
                    {
                        "ci_high": None,
                        "ci_low": None,
                        "ci_warning": None,
                        "median_shift_summary": "Cannot measure shift, base mode count not equal to new mode count",
                        "mode_end": "36.47",
                        "mode_name": "Mode 1",
                        "mode_start": "28.33",
                        "shift": None,
                        "shift_summary": None,
                    },
                ],
                "new_locations": [40.2],
                "new_mode_count": 1,
                "new_prominence": 0.08,
            },
            "silverman_warnings": [],
            "warning_c_delta": None,
        },
    ]

    query_params = (
        "?base_repository={}&new_repository={}&new_revision={}&framework={"
        "}&interval={}&no_subtests=true&test_version={}".format(
            try_repository.name,
            test_repository.name,
            test_perfcomp_push_2.revision,
            test_perf_signature.framework_id,
            604800,  # seven days in milliseconds
            "mann-whitney-u",
        )
    )

    response = client.get(reverse("perfcompare-results") + query_params)
    assert response.status_code == 200
    assert expected[0] == response.json()[0]
    assert response.json()[0]["base_parent_signature"] is None
    assert response.json()[0]["new_parent_signature"] is None
