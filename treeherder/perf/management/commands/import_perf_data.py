import datetime

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


def _add_series(pc, project_name, signature_hash, signature_props, verbosity,
                time_interval, parent_hash=None):
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
                     'test', 'suite', 'has_subtests', 'parent_signature']:
            extra_properties[k] = signature_props[k]

    repository = Repository.objects.get(name=project_name)

    defaults = {
        'test': signature_props.get('test', ''),
        'suite': signature_props['suite'],
        'option_collection': option_collection,
        'platform': platform,
        'framework': framework,
        'extra_properties': extra_properties,
        'has_subtests': signature_props.get('has_subtests', False),
        'last_updated': datetime.datetime.utcfromtimestamp(0)
    }

    if parent_hash:
        # the parent PerformanceSignature object should have already been created
        try:
            defaults['parent_signature'] = PerformanceSignature.objects.get(
                signature_hash=parent_hash,
                repository=repository,
                framework=framework)
        except PerformanceSignature.DoesNotExist:
            print("Cannot find parent signature with hash {} for signature {} ({})".format(
                parent_hash, signature_hash, signature_props))
            raise

    signature, _ = PerformanceSignature.objects.get_or_create(
        signature_hash=signature_hash,
        repository=repository,
        defaults=defaults)

    try:
        series = pc.get_performance_data(
            project_name, signatures=signature_hash,
            interval=time_interval)[signature_hash]
    except KeyError:
        print("WARNING: No performance data for signature {}".format(signature_hash))
        return

    try:
        new_series = []
        latest_timestamp = datetime.datetime.utcfromtimestamp(0)
        for datum in series:
            timestamp = datetime.datetime.utcfromtimestamp(datum['push_timestamp'])
            new_series.append(PerformanceDatum(
                repository=repository,
                result_set_id=datum['result_set_id'],
                job_id=datum['job_id'],
                signature=signature,
                value=datum['value'],
                push_timestamp=timestamp))
            if timestamp > latest_timestamp:
                latest_timestamp = timestamp
        PerformanceDatum.objects.bulk_create(new_series)
        signature.last_updated = latest_timestamp
        signature.save()
    except IntegrityError:
        with transaction.atomic():
            # bulk_create fails if data to import overlaps with existing data
            # so we fall back to creating objects one at a time
            for datum in series:
                PerformanceDatum.objects.get_or_create(
                    repository=repository,
                    result_set_id=datum['result_set_id'],
                    job_id=datum['job_id'],
                    signature=signature,
                    value=datum['value'],
                    push_timestamp=datetime.datetime.utcfromtimestamp(datum['push_timestamp']))


class Command(BaseCommand):
    help = "Pre-populate performance data from an external source"

    def add_arguments(self, parser):
        parser.add_argument('project')
        parser.add_argument(
            '--server',
            action='store',
            dest='server',
            default='https://treeherder.mozilla.org',
            help='Server to get data from, default https://treeherder.mozilla.org'
        )
        parser.add_argument(
            '--num-workers',
            action='store',
            dest='num_workers',
            type=int,
            default=4
        )
        parser.add_argument(
            '--filter-props',
            action='append',
            dest="filter_props",
            help="Only import series matching filter criteria (can "
            "specify multiple times)",
            metavar="KEY:VALUE"
        )
        parser.add_argument(
            '--time-interval',
            action='store',
            dest='time_interval',
            type=int,
            default=PerformanceTimeInterval.WEEK
        )

    def handle(self, *args, **options):
        project = options['project']

        time_interval = options['time_interval']

        pc = PerfherderClient(server_url=options['server'])
        signatures = pc.get_performance_signatures(
            project,
            interval=time_interval)

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
            # add signatures without parents first, then those with parents
            with_parents = []
            for signature_hash in signatures.get_signature_hashes():
                if 'parent_signature' in signatures[signature_hash]:
                    with_parents.append(signature_hash)
                else:
                    futures.append(executor.submit(_add_series, pc,
                                                   project,
                                                   signature_hash,
                                                   signatures[signature_hash],
                                                   options['verbosity'],
                                                   time_interval=time_interval))
            for signature_hash in with_parents:
                parent_hash = signatures[signature_hash]['parent_signature']
                futures.append(executor.submit(_add_series, pc,
                                               project,
                                               signature_hash,
                                               signatures[signature_hash],
                                               options['verbosity'],
                                               time_interval=time_interval,
                                               parent_hash=parent_hash))

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
