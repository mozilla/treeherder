import copy
from optparse import make_option

from django.core.management.base import BaseCommand

from treeherder.client import PerformanceTimeInterval
from treeherder.etl.perf_data_adapters import TalosDataAdapter
from treeherder.model import utils
from treeherder.model.derived.jobs import JobsModel
from treeherder.model.models import Datasource


class Command(BaseCommand):

    help = """
    Merge and update performance signatures to a minimal subset, concatenating
    identical series
    """

    SIGNIFICANT_KEYS = (['suite', 'test', 'subtest_signatures', 'test_options'] +
                        TalosDataAdapter.SIGNIFICANT_REFERENCE_DATA_KEYS)
    COUNTER_TESTS = ['responsiveness', 'Private Bytes', '% Processor Time',
                     'Modified Page List Bytes', 'Main_RSS']

    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='store',
                    help='Only merge data on specified project (defaults to all)'),
        make_option('--mysql-debug',
                    action='store_true',
                    dest='mysql_debug',
                    default=False),
    )

    @staticmethod
    def _get_suitekey(signature_props):
        suite_signature_props = copy.copy(signature_props)
        for k in ['test', 'subtest_signatures']:
            if suite_signature_props.get(k):
                del suite_signature_props[k]
        return TalosDataAdapter.get_series_signature(suite_signature_props)

    def _rewrite_series(self, jm, signature_hash, signature_properties,
                        subtest_signature_mapping, extra_subtest_signatures):
        new_props = TalosDataAdapter._transform_signature_properties(
            signature_properties,
            significant_keys=Command.SIGNIFICANT_KEYS)
        if 'subtest_signatures' in new_props:
            suitekey = self._get_suitekey(new_props)

            # rewrite a new set of subtest signatures
            old_subtest_signatures = new_props['subtest_signatures']
            new_subtest_signatures = set()
            for old_signature in old_subtest_signatures:
                try:
                    new_subtest_signatures.add(
                        subtest_signature_mapping[old_signature])
                except:
                    # key may not exist if script interrupted, get
                    # suite signatures via extra_subtest_signatures
                    for sig in extra_subtest_signatures.get(suitekey, []):
                        new_subtest_signatures.add(sig)
            new_props['subtest_signatures'] = sorted(new_subtest_signatures)
        new_hash = TalosDataAdapter.get_series_signature(new_props)
        print "%s -> %s" % (signature_hash, new_hash)
        jm.set_series_signature(new_hash, new_props)
        for time_interval in PerformanceTimeInterval.all_valid_time_intervals():
            series_list = jm.get_performance_series_from_signatures(
                [signature_hash], time_interval)

            series = utils.decompress_if_needed(series_list[0]['blob'])
            jm.store_performance_series(time_interval, 'talos_data',
                                        str(new_hash), series)

        jm.execute(proc='jobs.deletes.delete_performance_series',
                        placeholders=[signature_hash])
        jm.execute(proc='jobs.deletes.delete_series_signature',
                        placeholders=[signature_hash])

        return new_hash

    @staticmethod
    def _signature_needs_rewriting(signature_properties, signature_hash):
        return (not set(signature_properties.keys()).issubset(
            Command.SIGNIFICANT_KEYS) or
                signature_hash != TalosDataAdapter.get_series_signature(
                    signature_properties))

    def _rewrite_data(self, project, mysql_debug):

        signature_mapping = {}
        extra_subtest_signatures = {}

        with JobsModel(project) as jm:
            jm.DEBUG = mysql_debug
            summary = jm.get_performance_series_summary(
                max(PerformanceTimeInterval.all_valid_time_intervals()))
            # first pass: rewrite non-summary tests
            for (signature_hash, signature_properties) in summary.iteritems():
                if self._signature_needs_rewriting(signature_properties,
                                                   signature_hash) and \
                        'subtest_signatures' not in signature_properties:
                    new_hash = self._rewrite_series(jm, signature_hash,
                                                    signature_properties,
                                                    None, None)
                    signature_mapping[signature_hash] = new_hash
                elif (not signature_properties.get('subtest_signatures') and
                      signature_properties.get('test') not in
                      Command.COUNTER_TESTS):
                    # in case this script got interrupted, keep track of
                    # subtest signatures which have already been converted
                    suitekey = self._get_suitekey(signature_properties)

                    if extra_subtest_signatures.get(suitekey):
                        extra_subtest_signatures[suitekey].append(
                            signature_hash)
                    else:
                        extra_subtest_signatures[suitekey] = [signature_hash]

            # second pass: rewrite summary tests
            for (signature_hash, signature_properties) in summary.iteritems():
                if (self._signature_needs_rewriting(signature_properties,
                                                    signature_hash) and
                        signature_properties.get('subtest_signatures')):
                    self._rewrite_series(jm, signature_hash,
                                         signature_properties,
                                         signature_mapping,
                                         extra_subtest_signatures)

    def handle(self, *args, **options):
        if options['project']:
            projects = [options['project']]
        else:
            projects = Datasource.objects.values_list(
                'project', flat=True).distinct()

        for project in projects:
            print "Rewriting data for %s" % project
            self._rewrite_data(project, options['mysql_debug'])
