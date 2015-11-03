from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceSignature)


class Command(BaseCommand):

    help = "Remove performance data"
    args = '[signature1] [signature2] ...'

    def handle(self, *args, **options):
        if len(args) < 1:
            raise CommandError("Need to specify at least one signature to "
                               "remove")

        for signature_hash in args:
            signatures = PerformanceSignature.objects.filter(
                signature_hash=signature_hash)
            if not signatures:
                raise CommandError("No signatures matching hash '%s'" %
                                   signature_hash)
            datums = PerformanceDatum.objects.filter(
                signature__in=signatures)
            datums.delete()
            signatures.delete()
