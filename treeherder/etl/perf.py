import copy
import logging
import os
from hashlib import sha1

import simplejson as json
from jsonschema import validate

from treeherder.model.models import OptionCollection
from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)

logger = logging.getLogger(__name__)


PERFHERDER_SCHEMA = json.load(open(os.path.join('schemas',
                                                'performance-artifact.json')))


def _get_signature_hash(signature_properties):
    signature_prop_values = signature_properties.keys()
    str_values = []
    for value in signature_properties.values():
        if not isinstance(value, basestring):
            str_values.append(json.dumps(value, sort_keys=True))
        else:
            str_values.append(value)
    signature_prop_values.extend(str_values)

    sha = sha1()
    sha.update(''.join(map(lambda x: str(x), sorted(signature_prop_values))))

    return sha.hexdigest()


def _load_perf_datum(job, perf_datum):
    validate(perf_datum, PERFHERDER_SCHEMA)

    extra_properties = {}
    extra_options = ''
    reference_data = {
        'option_collection_hash': job.signature.option_collection_hash,
        'machine_platform': job.signature.machine_platform
    }

    option_collection = OptionCollection.objects.get(
        option_collection_hash=job.signature.option_collection_hash)

    try:
        framework = PerformanceFramework.objects.get(
            name=perf_datum['framework']['name'])
    except PerformanceFramework.DoesNotExist:
        logger.warning("Performance framework {} does not exist, skipping "
                       "load of performance artifacts".format(
                           perf_datum['framework']['name']))
        return
    if not framework.enabled:
        logger.info("Performance framework {} is not enabled, skipping"
                    .format(perf_datum['framework']['name']))
        return
    for suite in perf_datum['suites']:
        suite_extra_properties = copy.copy(extra_properties)
        suite_extra_options = copy.copy(extra_options)
        if suite.get('extraOptions'):
            suite_extra_properties = {
                'test_options': sorted(suite['extraOptions'])
            }
            # store extraOptions list as comma-separated str
            suite_extra_options = ' '.join(sorted(suite['extraOptions']))

        summary_signature_hash = None

        # if we have a summary value, create or get its signature by all its subtest
        # properties.
        if suite.get('value') is not None:
            # summary series
            summary_properties = {
                'suite': suite['name']
            }
            summary_properties.update(reference_data)
            summary_properties.update(suite_extra_properties)
            summary_signature_hash = _get_signature_hash(
                summary_properties)

            signature, _ = PerformanceSignature.objects.update_or_create(
                repository=job.repository,
                signature_hash=summary_signature_hash,
                framework=framework,
                defaults={
                    'test': '',
                    'suite': suite['name'],
                    'option_collection': option_collection,
                    'platform': job.machine_platform,
                    'extra_properties': suite_extra_properties,
                    # extra_properties to be deprecated in favour of extra_options
                    'extra_options': suite_extra_options,
                    'lower_is_better': suite.get('lowerIsBetter', True),
                    'has_subtests': True,
                    # these properties below can be either True, False, or null
                    # (None). Null indicates no preference has been set.
                    'should_alert': suite.get('shouldAlert'),
                    'alert_threshold': suite.get('alertThreshold'),
                    'min_back_window': suite.get('minBackWindow'),
                    'max_back_window': suite.get('maxBackWindow'),
                    'fore_window': suite.get('foreWindow'),
                    'last_updated': job.push.time
                })
            (_, datum_created) = PerformanceDatum.objects.get_or_create(
                repository=job.repository,
                job=job,
                push=job.push,
                signature=signature,
                push_timestamp=job.push.time,
                defaults={'value': suite['value']})
            if signature.should_alert is not False and datum_created and \
               job.repository.performance_alerts_enabled:
                generate_alerts.apply_async(args=[signature.id],
                                            routing_key='generate_perf_alerts')

        for subtest in suite['subtests']:
            subtest_properties = {
                'suite': suite['name'],
                'test': subtest['name']
            }
            subtest_properties.update(reference_data)
            subtest_properties.update(suite_extra_properties)

            summary_signature = None
            if summary_signature_hash is not None:
                subtest_properties.update({'parent_signature': summary_signature_hash})
                summary_signature = PerformanceSignature.objects.get(
                    repository=job.repository,
                    framework=framework,
                    signature_hash=summary_signature_hash)
            subtest_signature_hash = _get_signature_hash(subtest_properties)
            value = list(subtest['value'] for subtest in suite['subtests'] if
                         subtest['name'] == subtest_properties['test'])
            signature, _ = PerformanceSignature.objects.update_or_create(
                repository=job.repository,
                signature_hash=subtest_signature_hash,
                framework=framework,
                defaults={
                    'test': subtest_properties['test'],
                    'suite': suite['name'],
                    'option_collection': option_collection,
                    'platform': job.machine_platform,
                    'extra_properties': suite_extra_properties,
                    # extra_properties to be deprecated in favour of extra_options
                    'extra_options': suite_extra_options,
                    'lower_is_better': subtest.get('lowerIsBetter', True),
                    'has_subtests': False,
                    # these properties below can be either True, False, or
                    # null (None). Null indicates no preference has been
                    # set.
                    'should_alert': subtest.get('shouldAlert'),
                    'alert_threshold': subtest.get('alertThreshold'),
                    'min_back_window': subtest.get('minBackWindow'),
                    'max_back_window': subtest.get('maxBackWindow'),
                    'fore_window': subtest.get('foreWindow'),
                    'parent_signature': summary_signature,
                    'last_updated': job.push.time
                })
            (_, datum_created) = PerformanceDatum.objects.get_or_create(
                repository=job.repository,
                job=job,
                push=job.push,
                signature=signature,
                push_timestamp=job.push.time,
                defaults={'value': value[0]})

            # by default if there is no summary, we should schedule a
            # generate alerts task for the subtest, since we have new data
            # (this can be over-ridden by the optional "should alert"
            # property)
            if signature.should_alert or (signature.should_alert is None and
                                          (datum_created and
                                           job.repository.performance_alerts_enabled and
                                           suite.get('value') is None)):
                generate_alerts.apply_async(args=[signature.id],
                                            routing_key='generate_perf_alerts')


def store_performance_artifact(job, artifact):
    blob = json.loads(artifact['blob'])
    performance_data = blob['performance_data']

    if type(performance_data) == list:
        for perfdatum in performance_data:
            _load_perf_datum(job, perfdatum)
    else:
        _load_perf_datum(job, performance_data)
