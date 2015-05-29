# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.management.base import BaseCommand
from optparse import make_option
from treeherder.client import PerformanceTimeInterval
from treeherder.model.derived.jobs import JobsModel
from treeherder.model.models import Datasource
from treeherder.etl.perf_data_adapters import TalosDataAdapter


class Command(BaseCommand):

    help = """
    Merge and update performance signatures to a minimal subset, concatenating
    identical series
    """

    SIGNIFICANT_KEYS = (['suite', 'test', 'subtest_signatures', 'test_options'] +
                        TalosDataAdapter.SIGNIFICANT_REFERENCE_DATA_KEYS)

    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='store',
                    help='Only merge data on specified project (defaults to all)'),
        make_option('--mysql-debug',
                    action='store_true',
                    dest='mysql_debug',
                    default=False),
    )

    def _rewrite_series(self, jm, signature_hash, signature_properties,
                        subtest_signature_mapping):
        new_props = TalosDataAdapter._transform_signature_properties(
            signature_properties,
            significant_keys=Command.SIGNIFICANT_KEYS)
        if 'subtest_signatures' in new_props:
            # rewrite a new set of subtest signatures
            old_subtest_signatures = new_props['subtest_signatures']
            new_subtest_signatures = []
            for old_signature in old_subtest_signatures:
                new_subtest_signatures.append(
                    subtest_signature_mapping[old_signature])
            new_props['subtest_signatures'] = sorted(new_subtest_signatures)
        new_hash = TalosDataAdapter.get_series_signature(new_props)
        print "%s -> %s" % (signature_hash, new_hash)
        jm.set_series_signature(new_hash, new_props)
        for time_interval in PerformanceTimeInterval.all_valid_time_intervals():
            series_list = jm.get_performance_series_from_signatures(
                [signature_hash], time_interval)

            series = series_list[0]['blob']
            jm.store_performance_series(time_interval, 'talos_data',
                                        str(new_hash), series)

        jm.jobs_execute(proc='jobs.deletes.delete_performance_series',
                        placeholders=[signature_hash])
        jm.jobs_execute(proc='jobs.deletes.delete_series_signature',
                        placeholders=[signature_hash])

        return new_hash

    def _rewrite_data(self, project, mysql_debug):

        signature_mapping = {}

        with JobsModel(project) as jm:
            jm.DEBUG = mysql_debug
            summary = jm.get_performance_series_summary(PerformanceTimeInterval.NINETY_DAYS)
            # first pass: rewrite non-summary tests
            for (signature_hash, signature_properties) in summary.iteritems():
                if not set(signature_properties.keys()).issubset(
                        self.SIGNIFICANT_KEYS) and not signature_properties.get(
                            'subtest_signatures'):
                    new_hash = self._rewrite_series(jm, signature_hash,
                                                    signature_properties, None)
                    signature_mapping[signature_hash] = new_hash

            # second pass: rewrite summary tests
            for (signature_hash, signature_properties) in summary.iteritems():
                if not set(signature_properties.keys()).issubset(
                        self.SIGNIFICANT_KEYS) and signature_properties.get(
                            'subtest_signatures'):
                    self._rewrite_series(jm, signature_hash,
                                         signature_properties,
                                         signature_mapping)

    def handle(self, *args, **options):
        if options['project']:
            projects = [options['project']]
        else:
            projects = Datasource.objects.values_list(
                'project', flat=True).distinct()

        for project in projects:
            self._rewrite_data(project, options['mysql_debug'])
