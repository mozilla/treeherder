import copy
import datetime
import json
import time

import pytest
from typing import List

from django.db import IntegrityError

from tests.etl.test_perf_data_adapters import _verify_signature
from tests.test_utils import create_generic_job
from treeherder.etl.perf import store_performance_artifact
from treeherder.model.models import Push
from treeherder.perf.models import PerformanceDatum, PerformanceFramework, PerformanceSignature

FRAMEWORK_NAME = 'cheezburger'
MEASUREMENT_UNIT = 'ms'
UPDATED_MEASUREMENT_UNIT = 'seconds'


@pytest.fixture
def sample_perf_artifact() -> dict:
    return {
        'job_guid': 'fake_job_guid',
        'name': 'test',
        'type': 'test',
        'blob': {
            'framework': {'name': FRAMEWORK_NAME},
            'suites': [
                {
                    'name': 'cheezburger metrics',
                    'extraOptions': ['shell', 'e10s'],
                    'lowerIsBetter': True,
                    'value': 10.0,
                    'unit': MEASUREMENT_UNIT,
                    'subtests': [
                        {
                            'name': 'test1',
                            'value': 20.0,
                            'unit': MEASUREMENT_UNIT,
                            'lowerIsBetter': True,
                        },
                        {
                            'name': 'test2',
                            'value': 30.0,
                            'unit': MEASUREMENT_UNIT,
                            'lowerIsBetter': False,
                        },
                        {'name': 'test3', 'value': 40.0, 'unit': MEASUREMENT_UNIT,},
                    ],
                },
                {
                    'name': 'cheezburger metrics 2',
                    'lowerIsBetter': False,
                    'value': 10.0,
                    'unit': MEASUREMENT_UNIT,
                    'subtests': [{'name': 'test1', 'value': 20.0, 'unit': MEASUREMENT_UNIT,}],
                },
                {
                    'name': 'cheezburger metrics 3',
                    'value': 10.0,
                    'unit': MEASUREMENT_UNIT,
                    'subtests': [{'name': 'test1', 'value': 20.0, 'unit': MEASUREMENT_UNIT}],
                },
            ],
        },
    }


@pytest.fixture
def sibling_perf_artifacts(sample_perf_artifact: dict) -> List[dict]:
    """intended to belong to the same job"""
    artifacts = [copy.deepcopy(sample_perf_artifact) for _ in range(3)]

    for idx, artifact in enumerate(artifacts):
        mocked_push_timestamp = datetime.datetime.now() + datetime.timedelta(hours=idx)
        artifact['blob']['pushTimestamp'] = mocked_push_timestamp.isoformat()

        # having distinct values for suites & subtests
        # will make it easier to write tests
        for suite in artifact['blob']['suites']:
            suite['value'] = suite['value'] + idx
            for subtest in suite['subtests']:
                subtest['value'] = subtest['value'] + idx

    return artifacts


@pytest.fixture
def sample_perf_artifact_with_new_unit():
    return {
        'job_guid': 'new_fake_job_guid',
        'name': 'test',
        'type': 'test',
        'blob': {
            'framework': {'name': FRAMEWORK_NAME},
            'suites': [
                {
                    'name': 'cheezburger metrics',
                    'extraOptions': ['shell', 'e10s'],
                    'lowerIsBetter': True,
                    'value': 10.0,
                    'unit': UPDATED_MEASUREMENT_UNIT,
                    'subtests': [
                        {
                            'name': 'test1',
                            'value': 20.0,
                            'unit': UPDATED_MEASUREMENT_UNIT,
                            'lowerIsBetter': True,
                        },
                        {
                            'name': 'test2',
                            'value': 30.0,
                            'unit': MEASUREMENT_UNIT,
                            'lowerIsBetter': False,
                        },
                        {'name': 'test3', 'value': 40.0, 'unit': MEASUREMENT_UNIT,},
                    ],
                }
            ],
        },
    }


@pytest.fixture
def later_perf_push(test_repository):
    later_timestamp = datetime.datetime.fromtimestamp(int(time.time()) + 5)
    return Push.objects.create(
        repository=test_repository,
        revision='1234abcd12',
        author='foo@bar.com',
        time=later_timestamp,
    )


def _verify_datum(suitename, testname, value, push_timestamp):
    datum = PerformanceDatum.objects.get(
        signature=PerformanceSignature.objects.get(suite=suitename, test=testname)
    )
    assert datum.value == value
    assert datum.push_timestamp == push_timestamp


def _prepare_test_data(datum):
    PerformanceFramework.objects.get_or_create(name=FRAMEWORK_NAME, enabled=True)
    # the perf data adapter expects unserialized performance data
    submit_datum = copy.copy(datum)
    submit_datum['blob'] = json.dumps({'performance_data': submit_datum['blob']})
    perf_datum = datum['blob']
    return perf_datum, submit_datum


def _assert_hash_remains_unchanged():
    summary_signature = PerformanceSignature.objects.get(suite='cheezburger metrics', test='')
    # Ensure we don't inadvertently change the way we generate signature hashes.
    assert summary_signature.signature_hash == 'f451f0c9000a7f99e5dc2f05792bfdb0e11d0cac'
    subtest_signatures = PerformanceSignature.objects.filter(
        parent_signature=summary_signature
    ).values_list('signature_hash', flat=True)
    assert len(subtest_signatures) == 3


# Default (the tried & old) ingestion workflow
def test_default_ingest_workflow(
    test_repository,
    perf_push,
    later_perf_push,
    perf_job,
    generic_reference_data,
    sample_perf_artifact,
):
    """
    Assumes the job has a single PERFHERDER_DATA record in the log
    """
    perf_datum, submit_datum = _prepare_test_data(sample_perf_artifact)

    store_performance_artifact(perf_job, submit_datum)

    assert 8 == PerformanceSignature.objects.all().count()
    assert 1 == PerformanceFramework.objects.all().count()
    framework = PerformanceFramework.objects.first()
    assert FRAMEWORK_NAME == framework.name
    for suite in perf_datum['suites']:
        # verify summary, then subtests
        _verify_signature(
            test_repository.name,
            perf_datum['framework']['name'],
            suite['name'],
            '',
            'my_option_hash',
            'my_platform',
            suite.get('lowerIsBetter', True),
            suite.get('extraOptions'),
            suite.get('unit'),
            perf_push.time,
        )
        _verify_datum(suite['name'], '', suite['value'], perf_push.time)
        for subtest in suite['subtests']:
            _verify_signature(
                test_repository.name,
                perf_datum['framework']['name'],
                suite['name'],
                subtest['name'],
                'my_option_hash',
                'my_platform',
                subtest.get('lowerIsBetter', True),
                suite.get('extraOptions'),
                suite.get('unit'),
                perf_push.time,
            )
            _verify_datum(suite['name'], subtest['name'], subtest['value'], perf_push.time)


def test_hash_remains_unchanged_for_default_ingestion_workflow(
    test_repository, perf_job, sample_perf_artifact
):
    _, submit_datum = _prepare_test_data(sample_perf_artifact)
    store_performance_artifact(perf_job, submit_datum)

    _assert_hash_remains_unchanged()


def test_timestamp_can_be_updated_for_default_ingestion_workflow(
    test_repository, perf_job, later_perf_push, generic_reference_data, sample_perf_artifact
):
    _, submit_datum = _prepare_test_data(sample_perf_artifact)
    store_performance_artifact(perf_job, submit_datum)

    # send another datum, a little later, verify that signature is changed accordingly
    later_job = create_generic_job(
        'lateguid', test_repository, later_perf_push.id, generic_reference_data
    )
    store_performance_artifact(later_job, submit_datum)

    signature = PerformanceSignature.objects.get(suite='cheezburger metrics', test='test1')
    assert signature.last_updated == later_perf_push.time


def test_measurement_unit_can_be_updated(
    test_repository,
    later_perf_push,
    perf_job,
    generic_reference_data,
    sample_perf_artifact,
    sample_perf_artifact_with_new_unit,
):
    _, submit_datum = _prepare_test_data(sample_perf_artifact)
    store_performance_artifact(perf_job, submit_datum)

    _, updated_submit_datum = _prepare_test_data(sample_perf_artifact_with_new_unit)
    later_job = create_generic_job(
        'lateguid', test_repository, later_perf_push.id, generic_reference_data
    )
    store_performance_artifact(later_job, updated_submit_datum)

    summary_signature = PerformanceSignature.objects.get(suite='cheezburger metrics', test='')
    updated_subtest_signature = PerformanceSignature.objects.get(
        suite='cheezburger metrics', test='test1'
    )
    assert summary_signature.measurement_unit == UPDATED_MEASUREMENT_UNIT
    assert updated_subtest_signature.measurement_unit == UPDATED_MEASUREMENT_UNIT

    # no side effects when parent/sibling signatures
    # change measurement units
    not_changed_subtest_signature = PerformanceSignature.objects.get(
        suite='cheezburger metrics', test='test2'
    )
    assert not_changed_subtest_signature.measurement_unit == MEASUREMENT_UNIT


def test_changing_extra_options_decouples_perf_signatures(
    test_repository, later_perf_push, perf_job, generic_reference_data, sample_perf_artifact
):
    updated_perf_artifact = copy.deepcopy(sample_perf_artifact)
    updated_perf_artifact['blob']['suites'][0]['extraOptions'] = ['different-extra-options']
    later_job = create_generic_job(
        'lateguid', test_repository, later_perf_push.id, generic_reference_data
    )
    _, submit_datum = _prepare_test_data(sample_perf_artifact)
    _, updated_submit_datum = _prepare_test_data(updated_perf_artifact)

    store_performance_artifact(perf_job, submit_datum)
    initial_signature_amount = PerformanceSignature.objects.all().count()
    store_performance_artifact(later_job, updated_submit_datum)

    # Perfherder treats perf data with new properties as entirely new data.
    # Thus, it creates new & separate signatures for them.
    assert initial_signature_amount < PerformanceSignature.objects.all().count()


# Multi perf data (for the same job) ingestion workflow
def test_multi_data_can_be_ingested_for_same_job_and_push(
    test_repository, perf_job, sibling_perf_artifacts, settings,
):
    settings.PERFHERDER_ENABLE_MULTIDATA_INGESTION = True

    try:
        for artifact in sibling_perf_artifacts:
            _, submit_datum = _prepare_test_data(artifact)
            store_performance_artifact(perf_job, submit_datum)
    except IntegrityError:
        pytest.fail()


def test_multi_data_ingest_workflow(
    test_repository,
    perf_push,
    later_perf_push,
    perf_job,
    generic_reference_data,
    sibling_perf_artifacts,
    settings,
):
    """
    Assumes the job has multiple PERFHERDER_DATA record in the same log
    """
    settings.PERFHERDER_ENABLE_MULTIDATA_INGESTION = True

    def performance_datum_exists(**with_these_properties) -> bool:
        return PerformanceDatum.objects.filter(**with_these_properties).exists()

    # ingest all perf_data
    for perf_artifact in sibling_perf_artifacts:
        _, submit_datum = _prepare_test_data(perf_artifact)
        store_performance_artifact(perf_job, submit_datum)

    # check that all of them were ingested
    assert (
        PerformanceDatum.objects.all().count() == len(sibling_perf_artifacts) * 8
    )  # data per artifact

    assert 8 == PerformanceSignature.objects.all().count()
    assert 1 == PerformanceFramework.objects.all().count()
    framework = PerformanceFramework.objects.first()
    assert FRAMEWORK_NAME == framework.name

    # and their essential properties were correctly stored
    for artifact in sibling_perf_artifacts:
        artifact_blob = artifact['blob']
        common_properties = dict(  # to both suites & subtests
            repository=perf_job.repository,
            job=perf_job,
            push=perf_job.push,
            push_timestamp=artifact_blob['pushTimestamp'],
        )
        # check suites
        for suite in artifact_blob['suites']:
            assert performance_datum_exists(**common_properties, value=suite['value'],)

            # and subtests
            for subtest in suite['subtests']:
                assert performance_datum_exists(**common_properties, value=subtest['value'],)


def test_hash_remains_unchanged_for_multi_data_ingestion_workflow(
    test_repository, perf_job, sibling_perf_artifacts, settings,
):
    settings.PERFHERDER_ENABLE_MULTIDATA_INGESTION = True

    for artifact in sibling_perf_artifacts:
        _, submit_datum = _prepare_test_data(artifact)
        store_performance_artifact(perf_job, submit_datum)

    _assert_hash_remains_unchanged()


def test_timestamp_can_be_updated_for_multi_data_ingestion_workflow(
    test_repository,
    perf_job,
    later_perf_push,
    generic_reference_data,
    sibling_perf_artifacts,
    settings,
):
    settings.PERFHERDER_ENABLE_MULTIDATA_INGESTION = True

    for artifact in sibling_perf_artifacts:
        _, submit_datum = _prepare_test_data(artifact)
        store_performance_artifact(perf_job, submit_datum)

    signature = PerformanceSignature.objects.get(suite='cheezburger metrics', test='test1')
    last_artifact = sibling_perf_artifacts[-1]
    last_push_timestamp = datetime.datetime.fromisoformat(last_artifact['blob']['pushTimestamp'])

    assert signature.last_updated == last_push_timestamp
