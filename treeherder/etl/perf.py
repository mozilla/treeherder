import copy
import logging
import os
from hashlib import sha1

import simplejson as json
from jsonschema import validate

from treeherder.model.models import (MachinePlatform,
                                     OptionCollection,
                                     Push,
                                     Repository)
from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)
from treeherder.perf.tasks import generate_alerts

logger = logging.getLogger(__name__)


# keys useful for creating a non-redundant performance signature
SIGNIFICANT_REFERENCE_DATA_KEYS = ['option_collection_hash',
                                   'machine_platform']


PERFHERDER_SCHEMA = json.load(open(os.path.join('schemas',
                                                'performance-artifact.json')))


def _transform_signature_properties(properties, significant_keys=None):
    if significant_keys is None:
        significant_keys = SIGNIFICANT_REFERENCE_DATA_KEYS
    transformed_properties = {k: v for k, v in properties.iteritems() if
                              k in significant_keys}

    # HACK: determine if e10s is in job_group_symbol, and add an "e10s"
    # property to a 'test_options' property if so (we should probably
    # make talos produce this information somehow and consume it in the
    # future)
    if 'e10s' in properties.get('job_group_symbol', ''):
        transformed_properties['test_options'] = json.dumps(['e10s'])

    return transformed_properties


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


def _load_perf_artifact(project_name, reference_data, job_data, job_guid,
                        perf_datum):
    validate(perf_datum, PERFHERDER_SCHEMA)

    if 'e10s' in reference_data.get('job_group_symbol', ''):
        extra_properties = {'test_options': ['e10s']}
    else:
        extra_properties = {}

    # transform the reference data so it only contains what we actually
    # care about (for calculating the signature hash reproducibly), then
    # get the associated models
    reference_data = _transform_signature_properties(reference_data)
    option_collection = OptionCollection.objects.get(
        option_collection_hash=reference_data['option_collection_hash'])
    # there may be multiple machine platforms with the same platform: use
    # the first
    platform = MachinePlatform.objects.filter(
        platform=reference_data['machine_platform'])[0]
    repository = Repository.objects.get(
        name=project_name)

    # data for performance series
    job_id = job_data[job_guid]['id']
    push = Push.objects.get(id=job_data[job_guid]['push_id'])

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
        if suite.get('extraOptions'):
            suite_extra_properties = {
                'test_options': sorted(suite['extraOptions'])
            }
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
                repository=repository, signature_hash=summary_signature_hash,
                framework=framework,
                defaults={
                    'test': '',
                    'suite': suite['name'],
                    'option_collection': option_collection,
                    'platform': platform,
                    'extra_properties': suite_extra_properties,
                    'lower_is_better': suite.get('lowerIsBetter', True),
                    'has_subtests': True,
                    # these properties below can be either True, False, or null
                    # (None). Null indicates no preference has been set.
                    'should_alert': suite.get('shouldAlert'),
                    'alert_threshold': suite.get('alertThreshold'),
                    'min_back_window': suite.get('minBackWindow'),
                    'max_back_window': suite.get('maxBackWindow'),
                    'fore_window': suite.get('foreWindow'),
                    'last_updated': push.time
                })
            (_, datum_created) = PerformanceDatum.objects.get_or_create(
                repository=repository,
                push=push,
                job_id=job_id,
                signature=signature,
                push_timestamp=push.time,
                defaults={'value': suite['value']})
            if (signature.should_alert is not False and datum_created and
                (repository.performance_alerts_enabled)):
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
                    repository=repository,
                    framework=framework,
                    signature_hash=summary_signature_hash)
            subtest_signature_hash = _get_signature_hash(subtest_properties)
            value = list(subtest['value'] for subtest in suite['subtests'] if
                         subtest['name'] == subtest_properties['test'])
            signature, _ = PerformanceSignature.objects.update_or_create(
                repository=repository,
                signature_hash=subtest_signature_hash,
                framework=framework,
                defaults={
                    'test': subtest_properties['test'],
                    'suite': suite['name'],
                    'option_collection': option_collection,
                    'platform': platform,
                    'extra_properties': suite_extra_properties,
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
                    'last_updated': push.time
                })
            (_, datum_created) = PerformanceDatum.objects.get_or_create(
                repository=repository,
                push=push,
                job_id=job_id,
                signature=signature,
                push_timestamp=push.time,
                defaults={'value': value[0]})

            # by default if there is no summary, we should schedule a
            # generate alerts task for the subtest, since we have new data
            # (this can be over-ridden by the optional "should alert"
            # property)
            if signature.should_alert or (signature.should_alert is None and
                                          (datum_created and
                                           repository.performance_alerts_enabled and
                                           suite.get('value') is None)):
                generate_alerts.apply_async(args=[signature.id],
                                            routing_key='generate_perf_alerts')


def load_perf_artifacts(project_name, reference_data, job_data, datum):
    blob = json.loads(datum['blob'])
    performance_data = blob['performance_data']
    job_guid = datum["job_guid"]

    if type(performance_data) == list:
        for perfdatum in performance_data:
            _load_perf_artifact(project_name, reference_data, job_data,
                                job_guid, perfdatum)
    else:
        _load_perf_artifact(project_name, reference_data, job_data,
                            job_guid, performance_data)
