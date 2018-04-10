from __future__ import (division,
                        print_function)

from django.conf import settings
from django.core.management.base import (BaseCommand,
                                         CommandError)
from six import iteritems

from treeherder.client.thclient import (PerfherderClient,
                                        PerformanceTimeInterval)
from treeherder.perfalert.perfalert import (RevisionDatum,
                                            detect_changes)


class Command(BaseCommand):
    help = """
    Test running performance alert subsystem on a series, printing results
    to standard out
    """

    def add_arguments(self, parser):
        parser.add_argument(
            '--server',
            action='store',
            dest='server',
            default=settings.SITE_URL,
            help='Server to get data from, default to local instance'
        )
        parser.add_argument(
            '--time-interval',
            action='store',
            default=PerformanceTimeInterval.WEEK,
            type=int,
            help='Time interval to test alert code on (defaults to one week)'
        )
        parser.add_argument(
            '--project',
            action='append',
            help='Project to get signatures from (specify multiple time to get multiple projects'
        )
        parser.add_argument(
            '--signature',
            action='store',
            help='Signature hash to process, defaults to all non-subtests'
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
        if not options['project']:
            raise CommandError("Must specify at least one project with "
                               "--project")

        pc = PerfherderClient(server_url=options['server'])

        option_collection_hash = pc.get_option_collection_hash()

        # print csv header
        print(','.join(["project", "platform", "signature", "series",
                        "testrun_id", "push_timestamp", "change",
                        "percent change", "t-value", "revision"]))

        for project in options['project']:
            if options['signature']:
                signatures = [options['signature']]
                signature_data = pc.get_performance_signatures(
                    project, signatures=signatures,
                    interval=options['time_interval'])
            else:
                signature_data = pc.get_performance_signatures(
                    project, interval=options['time_interval'])
                signatures = []
                signatures_to_ignore = set()
                # if doing everything, only handle summary series
                for (signature, properties) in iteritems(signature_data):
                    signatures.append(signature)
                    if 'subtest_signatures' in properties:
                        # Don't alert on subtests which have a summary
                        signatures_to_ignore.update(properties['subtest_signatures'])
                signatures = [signature for signature in signatures
                              if signature not in signatures_to_ignore]

            for signature in signatures:
                series = pc.get_performance_data(
                    project, signatures=signature,
                    interval=options['time_interval'])[signature]

                series_properties = signature_data.get(signature)

                data = []

                for (push_id, timestamp, value) in zip(
                        series['result_set_id'], series['push_timestamp'],
                        series['value']):
                    data.append(RevisionDatum(timestamp, value, testrun_id=push_id))

                for r in detect_changes(data):
                    if r.state == 'regression':
                        pushes = pc.get_pushes(project, id=r.testrun_id)
                        revision = pushes[0]['revision'] if pushes else ''
                        initial_value = r.historical_stats['avg']
                        new_value = r.forward_stats['avg']
                        if initial_value != 0:
                            pct_change = 100.0 * abs(new_value - initial_value) / float(initial_value)
                        else:
                            pct_change = 0.0
                        delta = (new_value - initial_value)
                        print(','.join(map(
                            str,
                            [project, series_properties['machine_platform'],
                             signature, self._get_series_description(
                                 option_collection_hash,
                                 series_properties),
                             r.testrun_id, r.push_timestamp, delta,
                             pct_change, r.t, revision[0:12]])))
