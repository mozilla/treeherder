import copy
import logging
from datetime import datetime
from hashlib import sha1
from typing import List, Tuple

import simplejson as json

from django.conf import settings
from treeherder.log_parser.utils import validate_perf_data
from treeherder.model.models import Job, OptionCollection
from treeherder.perf.models import (
    MultiCommitDatum,
    PerformanceDatum,
    PerformanceFramework,
    PerformanceSignature,
)
from treeherder.perf.tasks import generate_alerts

logger = logging.getLogger(__name__)


def _get_application_name(validated_perf_datum: dict):
    try:
        return validated_perf_datum['application']['name']
    except KeyError:
        return ''


def _get_signature_hash(signature_properties):
    signature_prop_values = list(signature_properties.keys())
    str_values = []
    for value in signature_properties.values():
        if not isinstance(value, str):
            str_values.append(json.dumps(value, sort_keys=True))
        else:
            str_values.append(value)
    signature_prop_values.extend(str_values)

    sha = sha1()
    sha.update(''.join(map(str, sorted(signature_prop_values))).encode('utf-8'))

    return sha.hexdigest()


def _order_and_concat(words: List) -> str:
    return ' '.join(sorted(words))


def _create_or_update_signature(repository, signature_hash, framework, application, defaults):
    signature, created = PerformanceSignature.objects.get_or_create(
        repository=repository,
        signature_hash=signature_hash,
        framework=framework,
        application=application,
        defaults=defaults,
    )
    if not created:
        if signature.last_updated > defaults['last_updated']:
            defaults['last_updated'] = signature.last_updated
        signature, _ = PerformanceSignature.objects.update_or_create(
            repository=repository,
            signature_hash=signature_hash,
            framework=framework,
            application=application,
            defaults=defaults,
        )
    return signature


def _deduce_push_timestamp(perf_datum: dict, job_push_time: datetime) -> Tuple[datetime, bool]:
    is_multi_commit = False
    if not settings.PERFHERDER_ENABLE_MULTIDATA_INGESTION:
        # the old way of ingestion
        return job_push_time, is_multi_commit

    multidata_timestamp = perf_datum.get('pushTimestamp', None)
    if multidata_timestamp:
        multidata_timestamp = datetime.fromtimestamp(multidata_timestamp)
        is_multi_commit = True

    return (multidata_timestamp or job_push_time), is_multi_commit


def _load_perf_datum(job: Job, perf_datum: dict):
    validate_perf_data(perf_datum)

    extra_properties = {}
    reference_data = {
        'option_collection_hash': job.signature.option_collection_hash,
        'machine_platform': job.signature.machine_platform,
    }

    option_collection = OptionCollection.objects.get(
        option_collection_hash=job.signature.option_collection_hash
    )

    try:
        framework = PerformanceFramework.objects.get(name=perf_datum['framework']['name'])
    except PerformanceFramework.DoesNotExist:
        if perf_datum['framework']['name'] == "job_resource_usage":
            return
        logger.warning(
            "Performance framework %s does not exist, skipping " "load of performance artifacts",
            perf_datum['framework']['name'],
        )
        return
    if not framework.enabled:
        logger.info(
            "Performance framework %s is not enabled, skipping", perf_datum['framework']['name']
        )
        return
    application = _get_application_name(perf_datum)
    for suite in perf_datum['suites']:
        suite_extra_properties = copy.copy(extra_properties)
        ordered_tags = _order_and_concat(suite.get('tags', []))
        deduced_timestamp, is_multi_commit = _deduce_push_timestamp(perf_datum, job.push.time)
        suite_extra_options = ''

        if suite.get('extraOptions'):
            suite_extra_properties = {'test_options': sorted(suite['extraOptions'])}
            suite_extra_options = _order_and_concat(suite['extraOptions'])
        summary_signature_hash = None

        # if we have a summary value, create or get its signature by all its subtest
        # properties.
        if suite.get('value') is not None:
            # summary series
            summary_properties = {'suite': suite['name']}
            summary_properties.update(reference_data)
            summary_properties.update(suite_extra_properties)
            summary_signature_hash = _get_signature_hash(summary_properties)
            signature = _create_or_update_signature(
                job.repository,
                summary_signature_hash,
                framework,
                application,
                {
                    'test': '',
                    'suite': suite['name'],
                    'suite_public_name': suite.get('publicName'),
                    'option_collection': option_collection,
                    'platform': job.machine_platform,
                    'tags': ordered_tags,
                    'extra_options': suite_extra_options,
                    'measurement_unit': suite.get('unit'),
                    'lower_is_better': suite.get('lowerIsBetter', True),
                    'has_subtests': True,
                    # these properties below can be either True, False, or null
                    # (None). Null indicates no preference has been set.
                    'should_alert': suite.get('shouldAlert'),
                    'alert_change_type': PerformanceSignature._get_alert_change_type(
                        suite.get('alertChangeType')
                    ),
                    'alert_threshold': suite.get('alertThreshold'),
                    'min_back_window': suite.get('minBackWindow'),
                    'max_back_window': suite.get('maxBackWindow'),
                    'fore_window': suite.get('foreWindow'),
                    'last_updated': job.push.time,
                },
            )

            (suite_datum, datum_created) = PerformanceDatum.objects.get_or_create(
                repository=job.repository,
                job=job,
                push=job.push,
                signature=signature,
                push_timestamp=deduced_timestamp,
                defaults={'value': suite['value']},
            )
            if suite_datum.should_mark_as_multi_commit(is_multi_commit, datum_created):
                # keep a register with all multi commit perf data
                MultiCommitDatum.objects.create(perf_datum=suite_datum)
            if (
                signature.should_alert is not False
                and datum_created
                and job.repository.performance_alerts_enabled
                and job.tier_is_sheriffable
            ):
                generate_alerts.apply_async(args=[signature.id], queue='generate_perf_alerts')

        for subtest in suite['subtests']:
            subtest_properties = {'suite': suite['name'], 'test': subtest['name']}
            subtest_properties.update(reference_data)
            subtest_properties.update(suite_extra_properties)

            summary_signature = None
            if summary_signature_hash is not None:
                subtest_properties.update({'parent_signature': summary_signature_hash})
                summary_signature = PerformanceSignature.objects.get(
                    repository=job.repository,
                    framework=framework,
                    signature_hash=summary_signature_hash,
                    application=application,
                )
            subtest_signature_hash = _get_signature_hash(subtest_properties)
            value = list(
                subtest['value']
                for subtest in suite['subtests']
                if subtest['name'] == subtest_properties['test']
            )
            signature = _create_or_update_signature(
                job.repository,
                subtest_signature_hash,
                framework,
                application,
                {
                    'test': subtest_properties['test'],
                    'suite': suite['name'],
                    'test_public_name': subtest.get('publicName'),
                    'suite_public_name': suite.get('publicName'),
                    'option_collection': option_collection,
                    'platform': job.machine_platform,
                    'tags': ordered_tags,
                    'extra_options': suite_extra_options,
                    'measurement_unit': subtest.get('unit'),
                    'lower_is_better': subtest.get('lowerIsBetter', True),
                    'has_subtests': False,
                    # these properties below can be either True, False, or
                    # null (None). Null indicates no preference has been
                    # set.
                    'should_alert': subtest.get('shouldAlert'),
                    'alert_change_type': PerformanceSignature._get_alert_change_type(
                        subtest.get('alertChangeType')
                    ),
                    'alert_threshold': subtest.get('alertThreshold'),
                    'min_back_window': subtest.get('minBackWindow'),
                    'max_back_window': subtest.get('maxBackWindow'),
                    'fore_window': subtest.get('foreWindow'),
                    'parent_signature': summary_signature,
                    'last_updated': job.push.time,
                },
            )
            (subtest_datum, datum_created) = PerformanceDatum.objects.get_or_create(
                repository=job.repository,
                job=job,
                push=job.push,
                signature=signature,
                push_timestamp=deduced_timestamp,
                defaults={'value': value[0]},
            )
            if subtest_datum.should_mark_as_multi_commit(is_multi_commit, datum_created):
                # keep a register with all multi commit perf data
                MultiCommitDatum.objects.create(perf_datum=subtest_datum)

            # by default if there is no summary, we should schedule a
            # generate alerts task for the subtest, since we have new data
            # (this can be over-ridden by the optional "should alert"
            # property)
            if (
                (
                    signature.should_alert
                    or (signature.should_alert is None and suite.get('value') is None)
                )
                and datum_created
                and job.repository.performance_alerts_enabled
                and job.tier_is_sheriffable
            ):
                generate_alerts.apply_async(args=[signature.id], queue='generate_perf_alerts')


def store_performance_artifact(job, artifact):
    blob = json.loads(artifact['blob'])
    performance_data = blob['performance_data']

    if isinstance(performance_data, list):
        for perfdatum in performance_data:
            _load_perf_datum(job, perfdatum)
    else:
        _load_perf_datum(job, performance_data)
