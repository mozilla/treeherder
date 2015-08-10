from optparse import make_option
from urlparse import urlparse

import concurrent.futures
from django.core.management.base import BaseCommand, CommandError

from treeherder.client import PerfherderClient, PerformanceTimeInterval
from treeherder.model.derived.jobs import JobsModel


def _add_series(server_params, project, time_intervals, signature_hash,
                signature_props, mysql_debug, verbose):
    with JobsModel(project) as jm:
        jm.DEBUG = mysql_debug
        if verbose:
            print(signature_hash)

        jm.set_series_signature(signature_hash, signature_props)
        for time_interval in time_intervals:
            pc = PerfherderClient(protocol=server_params.scheme,
                                  host=server_params.netloc)
            series = pc.get_performance_series(project, signature_hash,
                                               time_interval=time_interval)
            jm.store_performance_series(time_interval, 'talos_data',
                                        str(signature_hash),
                                        series)


class Command(BaseCommand):

    help = "Pre-populate performance data from an external source"
    args = '<project>'

    option_list = BaseCommand.option_list + (
        make_option('--server',
                    action='store',
                    dest='server',
                    default='https://treeherder.mozilla.org',
                    help='Server to get data from, default https://treeherder.mozilla.org'),
        make_option('--mysql-debug',
                    action='store_true',
                    dest='mysql_debug',
                    default=False),
        make_option('--num-workers',
                    action='store',
                    dest='num_workers',
                    type='int',
                    default=4),
        make_option('--verbose',
                    action='store_true',
                    default=False),
        make_option('--time-interval',
                    action='store',
                    default=None,
                    type='int',
                    help="Time interval to fetch (defaults to all)"),
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

        if options['time_interval'] is None:
            time_intervals = PerformanceTimeInterval.all_valid_time_intervals()
        else:
            time_intervals = [options['time_interval']]

        with concurrent.futures.ProcessPoolExecutor(
                options['num_workers']) as executor:
            futures = []

            for signature_hash in signatures.get_signature_hashes():
                futures.append(executor.submit(_add_series, server_params,
                                               project,
                                               time_intervals,
                                               signature_hash,
                                               signatures[signature_hash],
                                               options['mysql_debug'],
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
