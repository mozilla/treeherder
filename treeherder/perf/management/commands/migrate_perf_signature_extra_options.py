import time
from optparse import make_option

from django.core.management.base import BaseCommand

from treeherder.perf.models import PerformanceSignature


class Command(BaseCommand):
    help = "migrate legacy signature data to new schema, which has the new extra_options field"
    option_list = BaseCommand.option_list + (
        make_option('--interval',
                    dest='interval',
                    help='Wait specified interval between signature migrations',
                    type='float',
                    default=0.0),
    )

    def _migrate_signature(self, signature, sleep_interval):
        extra_options = ','.join(sorted(signature.extra_properties['test_options']))
        signature.extra_options = extra_options
        signature.save()
        time.sleep(sleep_interval)

    def handle(self, *args, **options):
        try:
            perf_signatures = PerformanceSignature.objects.all()
        except PerformanceSignature.DoesNotExist:
            print("PerformanceSignature does not exist")
            raise

        print("Migrating PerformanceSignatures...")

        for perf_signature in perf_signatures:
            self._migrate_signature(perf_signature, options['interval'])

        print("Done")
