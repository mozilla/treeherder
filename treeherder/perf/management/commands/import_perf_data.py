import datetime
from optparse import make_option
from urlparse import urlparse

import concurrent.futures
from django.core.management.base import (BaseCommand,
                                         CommandError)
from django.db import (IntegrityError,
                       transaction)

from treeherder.client import (PerfherderClient,
                               PerformanceTimeInterval)
from treeherder.model.models import (MachinePlatform,
                                     OptionCollection,
                                     Repository)
from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)


def _add_series(pc, project_name, signature_hash, signature_props, verbosity):
    if verbosity == 3:
        print(signature_hash)

    try:
        option_collection = OptionCollection.objects.get(
            option_collection_hash=signature_props['option_collection_hash'])
    except OptionCollection.DoesNotExist:
        print("Option collection for {} ({}) does not exist".format(
            signature_hash, signature_props))
        raise

    # can't use "get" for platform because we currently have more than one platform
    # with the same name in the database
    platform = MachinePlatform.objects.filter(
        platform=signature_props['machine_platform']).first()
    if not platform:
        raise Exception("Platform for %s (%s) does not exist".format(
            signature_hash, signature_props))

    framework = PerformanceFramework.objects.get(name='talos')

    extra_properties = {}
    for k in signature_props.keys():
        if k not in ['option_collection_hash', 'machine_platform',
                     'test', 'suite']:
            extra_properties[k] = signature_props[k]

    repository = Repository.objects.get(name=project_name)

    signature, _ = PerformanceSignature.objects.get_or_create(
        signature_hash=signature_hash,
        repository=repository,
        defaults={
            'test': signature_props.get('test', ''),
            'suite': signature_props['suite'],
            'option_collection': option_collection,
            'platform': platform,
            'framework': framework,
            'extra_properties': extra_properties,
            'last_updated': datetime.datetime.fromtimestamp(0)
        })

    series = pc.get_performance_data(
        project_name, signatures=signature_hash,
        time_interval=PerformanceTimeInterval.ONE_YEAR)[signature_hash]

    with transaction.atomic():
        new_series = []
        latest_timestamp = datetime.datetime.fromtimestamp(0)
        for datum in series:
            timestamp = datetime.datetime.fromtimestamp(datum['push_timestamp'])
            new_series.append(PerformanceDatum(
                repository=repository,
                result_set_id=datum['result_set_id'],
                job_id=datum['job_id'],
                signature=signature,
                value=datum['value'],
                push_timestamp=timestamp))
            if timestamp > latest_timestamp:
                latest_timestamp = timestamp

    try:
        PerformanceDatum.objects.bulk_create(new_series)
    except IntegrityError:
        for datum in series:
            PerformanceDatum.objects.get_or_create(
                repository=repository,
                result_set_id=datum['result_set_id'],
                job_id=datum['job_id'],
                signature=signature,
                value=datum['value'],
                push_timestamp=datetime.datetime.fromtimestamp(datum['push_timestamp']))

    signature.last_updated = latest_timestamp
    signature.save()


class Command(BaseCommand):

    help = "Pre-populate performance data from an external source"
    args = '<project>'

    option_list = BaseCommand.option_list + (
        make_option('--server',
                    action='store',
                    dest='server',
                    default='https://treeherder.mozilla.org',
                    help='Server to get data from, default https://treeherder.mozilla.org'),
        make_option('--num-workers',
                    action='store',
                    dest='num_workers',
                    type='int',
                    default=4),
        make_option('--filter-props',
                    action='append',
                    dest="filter_props",
                    help="Only import series matching filter criteria (can "
                    "specify multiple times)",
                    type="string",
                    metavar="KEY:VALUE"),

        make_option('--time-interval',
                    action='store',
                    dest='time_interval',
                    type='int',
                    default=PerformanceTimeInterval.WEEK),
    )

    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError("Need to (only) specify project/branch")
        project = args[0]

        server_params = urlparse(options['server'])

        pc = PerfherderClient(protocol=server_params.scheme,
                              host=server_params.netloc)
        signatures = pc.get_performance_signatures(
            project,
            time_interval=options['time_interval'])

        if options['filter_props']:
            for kv in options['filter_props']:
                if ':' not in kv or len(kv) < 3:
                    raise CommandError("Must specify --filter-props as "
                                       "'key:value'")
                k, v = kv.split(':')
                signatures = signatures.filter((k, v))

        with concurrent.futures.ProcessPoolExecutor(
                options['num_workers']) as executor:
            futures = []

            for signature_hash in signatures.get_signature_hashes():
                futures.append(executor.submit(_add_series, pc,
                                               project,
                                               signature_hash,
                                               signatures[signature_hash],
                                               options['verbosity']))
            for future in futures:
                try:
                    future.result()
                except Exception as e:
                    self.stderr.write("FAIL: {}".format(e))
                    # shutdown any pending tasks and exit (if something
                    # is in progress, no wait to stop it)
                    executor.shutdown(wait=False)
                    for future in futures:
                        future.cancel()
                    raise CommandError(
                        "Failed to import performance data: {}".format(e))
