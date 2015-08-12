# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.management.base import BaseCommand, CommandError
from optparse import make_option
from treeherder.client import PerfherderClient, PerformanceTimeInterval
from urlparse import urlparse
from treeherder.model.models import (MachinePlatform,
                                     OptionCollection,
                                     PerformanceFramework,
                                     PerformanceSignature,
                                     PerformanceDatum, Repository)

import concurrent.futures
import datetime

def _add_series(server_params, project_name, signature_hash, signature_props, verbose):
    if not PerformanceSignature.objects.filter(uuid=signature_hash):
        try:
            option_collection = OptionCollection.objects.filter(
                option_collection_hash=signature_props['option_collection_hash'])[0]
            platform = MachinePlatform.objects.filter(
                platform=signature_props['machine_platform'])[0]
        except:
            print "Platform or object collection for %s (%s) does not exist" % (signature_hash,
                                                                                signature_props)
            return

        try:
            framework = PerformanceFramework.objects.get(
                name='talos')
        except:
            framework = PerformanceFramework.objects.create(name='talos')
            framework.save()

        extra_properties = {}
        for k in signature_props.keys():
            if k not in ['option_collection_hash', 'machine_platform',
                         'test', 'suite']:
                extra_properties[k] = signature_props[k]

        s = PerformanceSignature.objects.create(
            uuid=signature_hash,
            test=signature_props.get('test'),
            suite=signature_props['suite'],
            option_collection=option_collection,
            platform=platform,
            framework=framework,
            extra_properties=extra_properties)
        s.save()

    pc = PerfherderClient(protocol=server_params.scheme,
                          host=server_params.netloc)
    series = pc.get_performance_series(project_name, signature_hash,
                                       time_interval=PerformanceTimeInterval.ONE_YEAR)
    repository = Repository.objects.get(name=project_name)
    signature = PerformanceSignature.objects.get(uuid=signature_hash)
    for datum in series:
        perfdatum = {}
        for k in datum.keys():
            if k not in ['result_set_id', 'job_id', 'push_timestamp']:
                perfdatum[k] = datum[k]
        d = PerformanceDatum.objects.create(
            repository=repository,
            result_set_id=datum['result_set_id'],
            job_id=datum['job_id'],
            signature=signature,
            datum=perfdatum,
            push_timestamp=datetime.datetime.fromtimestamp(datum['push_timestamp']))
        d.save()

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
