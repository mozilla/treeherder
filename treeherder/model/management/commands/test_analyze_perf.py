from optparse import make_option
from urlparse import urlparse

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from treeherder.client import PerfherderClient, PerformanceTimeInterval
from treeherder.perfalert import PerfDatum, TalosAnalyzer


class Command(BaseCommand):

    help = """
    Test running performance alert subsystem on a series
    """

    option_list = BaseCommand.option_list + (
        make_option('--server',
                    action='store',
                    dest='server',
                    default=None,
                    help='Server to get data from, default to local instance'),
        make_option('--time-interval',
                    action='store',
                    default=PerformanceTimeInterval.WEEK,
                    type='int',
                    help='Time interval to test alert code on (defaults to one week)'),
        make_option('--project',
                    action='append',
                    help='Project to get signatures from (specify multiple time to get multiple projects'),
        make_option('--signature',
                    action='store',
                    help='Signature hash to process, defaults to all summary series')
    )

    @staticmethod
    def _get_series_description(option_collection_hash, series_properties):
        testname = series_properties.get('test', 'summary')
        option_hash_strs = [o['name'] for o in option_collection_hash[
            series_properties['option_collection_hash']]]
        test_options = (series_properties.get('test_options', []) +
                        option_hash_strs)
        return " ".join([str(s) for s in [series_properties['suite'],
                                          testname] + test_options])

    def handle(self, *args, **options):
        if options['server']:
            server_params = urlparse(options['server'])
            server_protocol = server_params.scheme
            server_host = server_params.netloc
        else:
            server_protocol = settings.TREEHERDER_REQUEST_PROTOCOL
            server_host = settings.TREEHERDER_REQUEST_HOST

        if not options['project']:
            raise CommandError("Must specify at least one project with "
                               "--project")

        pc = PerfherderClient(protocol=server_protocol,
                              host=server_host)

        option_collection_hash = pc.get_option_collection_hash()

        # print csv header
        print ','.join(["project", "platform", "signature", "series",
                        "testrun_id", "push_timestamp", "change",
                        "percent change", "t-value", "revision"])

        for project in options['project']:
            if options['signature']:
                signatures = [options['signature']]
                signature_data = {}
            else:
                signature_data = pc.get_performance_signatures(
                    project, time_interval=options['time_interval'])
                signatures = []
                # if doing everything, only handle summary series
                for (signature, properties) in signature_data.iteritems():
                    if 'subtest_signatures' in properties:
                        signatures.append(signature)

            for signature in signatures:
                series = pc.get_performance_series(
                    project, signature,
                    time_interval=options['time_interval'])

                series_properties = signature_data.get(signature)
                if not series_properties:
                    series_properties = pc.get_performance_signature_properties(
                        project, signature)

                if series_properties.get('subtest_signatures') is not None:
                    meanvar = 'geomean'
                else:
                    meanvar = 'mean'

                perf_data = []
                for (result_set_id, timestamp, mean) in zip(
                        series['result_set_id'], series['push_timestamp'],
                        series[meanvar]):
                    perf_data.append(PerfDatum(timestamp, mean, testrun_id=result_set_id))

                ta = TalosAnalyzer()
                ta.addData(perf_data)
                for r in ta.analyze_t():
                    if r.state == 'regression':
                        resultsets = pc.get_resultsets(project,
                                                       id=r.testrun_id)
                        if len(resultsets):
                            revision = resultsets[0]['revision']
                        else:
                            revision = ''
                        initial_value = r.historical_stats['avg']
                        new_value = r.forward_stats['avg']
                        if initial_value != 0:
                            pct_change = 100.0 * abs(new_value - initial_value) / float(initial_value)
                        else:
                            pct_change = 0.0
                        delta = (new_value - initial_value)
                        print ','.join(map(
                            lambda v: str(v),
                            [project, series_properties['machine_platform'],
                             signature, self._get_series_description(
                                 option_collection_hash,
                                 series_properties),
                             r.testrun_id, r.push_timestamp, delta,
                             pct_change, r.t, revision[0:12]]))
