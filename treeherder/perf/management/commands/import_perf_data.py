import datetime
from optparse import make_option
from urlparse import urlparse

import concurrent.futures
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from treeherder.client import PerfherderClient, PerformanceTimeInterval
from treeherder.model.models import (MachinePlatform,
                                     OptionCollection,
                                     PerformanceFramework,
                                     PerformanceSignature,
                                     PerformanceDatum, Repository)


def _add_series(server_params, project_name, signature_hash, signature_props, verbose):
    if verbose:
        print signature_hash

    try:
        option_collection = OptionCollection.objects.get(
            option_collection_hash=signature_props['option_collection_hash'])
    except OptionCollection.DoesNotExist:
        print "Option collection for {} ({}) does not exist".format(
            signature_hash, signature_props)
        raise

    try:
        # can't use "get" for platform because we currently have more than one platform
        # with the same name in the database
        platform = MachinePlatform.objects.filter(
            platform=signature_props['machine_platform'])[0]
    except:
        print "Platform for %s (%s) does not exist".format(
            signature_hash, signature_props)
        raise

    framework = PerformanceFramework.objects.get(name='talos')

    extra_properties = {}
    for k in signature_props.keys():
        if k not in ['option_collection_hash', 'machine_platform',
                     'test', 'suite']:
            extra_properties[k] = signature_props[k]

    signature = PerformanceSignature.objects.get_or_create(
        signature_hash=signature_hash,
        defaults={
            'test': signature_props.get('test', ''),
            'suite': signature_props['suite'],
            'option_collection': option_collection,
            'platform': platform,
            'framework': framework,
            'extra_properties': extra_properties
        })

    pc = PerfherderClient(protocol=server_params.scheme,
                          host=server_params.netloc)
    series = pc.get_performance_data(
        project_name, signatures=signature_hash,
        time_interval=PerformanceTimeInterval.ONE_YEAR)[signature_hash]
    repository = Repository.objects.get(name=project_name)

    with transaction.atomic():
        for datum in series:
            perfdatum = {}
            for k in datum.keys():
                if k not in ['result_set_id', 'job_id', 'push_timestamp']:
                    perfdatum[k] = datum[k]

            p = PerformanceDatum.objects.create(
                repository=repository,
                result_set_id=datum['result_set_id'],
                job_id=datum['job_id'],
                signature=signature,
                datum=perfdatum,
                push_timestamp=datetime.datetime.fromtimestamp(datum['push_timestamp']))
            p.save()


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
        make_option('--verbose',
                    action='store_true',
                    default=False),
        make_option('--filter-props',
                    action='append',
                    dest="filter_props",
                    help="Only import series matching filter criteria (can "
                    "specify multiple times)",
                    type="string",
                    metavar="KEY:VALUE"),
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
            time_interval=PerformanceTimeInterval.NINETY_DAYS)

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
                futures.append(executor.submit(_add_series, server_params,
                                               project,
                                               signature_hash,
                                               signatures[signature_hash],
                                               options['verbose']))
            for future in futures:
                try:
                    future.result()
                except Exception, e:
                    self.stderr.write("FAIL: {}".format(e))
                    # shutdown any pending tasks and exit (if something
                    # is in progress, no wait to stop it)
                    executor.shutdown(wait=False)
                    for future in futures:
                        future.cancel()
                    raise CommandError(
                        "Failed to import performance data: {}".format(e))
