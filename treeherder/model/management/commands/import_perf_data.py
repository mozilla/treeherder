# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.management.base import BaseCommand, CommandError
from optparse import make_option
from treeherder.client import PerfherderClient
from treeherder.model.derived.jobs import JobsModel

import concurrent.futures
import json


def _add_series(project, time_interval, signature_hash, signature_props,
                mysql_debug):
    with JobsModel(project) as jm:
        jm.DEBUG = mysql_debug
        signature_property_placeholders = []
        for (k, v) in signature_props.iteritems():
            if k == 'subtest_signatures':
                v = json.dumps(v)
            signature_property_placeholders.append([
                str(signature_hash), str(k), str(v),
                str(signature_hash), str(k), str(v),
            ])

        jm.jobs_execute(
            proc='jobs.inserts.set_series_signature',
            placeholders=signature_property_placeholders,
            executemany=True)

        pc = PerfherderClient()
        series = pc.get_performance_series(project, signature_hash)
        jm.store_performance_series(time_interval, 'talos_data',
                                    str(signature_hash),
                                    series.blob)

class Command(BaseCommand):

    help = "Pre-populate performance data from an external source"
    args = '<project> <time interval>'

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
    )

    def handle(self, *args, **options):
        if len(args) != 2:
            raise CommandError("Need to (only) specify project/branch and time interval")
        (project, time_interval) = args

        pc = PerfherderClient()
        signatures = pc.get_performance_signatures(project)
        with concurrent.futures.ThreadPoolExecutor(
                options['num_workers']) as executor:
            for signature_hash in signatures.get_signature_hashes():
                signature_props = signatures[signature_hash]
                executor.submit(_add_series, project, time_interval,
                                signature_hash, signature_props,
                                options['mysql_debug'])
