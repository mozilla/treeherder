from django.core.management.base import (CommandError,
                                         LabelCommand)

from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceSignature)


class Command(LabelCommand):
    help = "Remove performance data"
    label = "signature"

    def handle_label(signature_hash, **options):
        signatures = PerformanceSignature.objects.filter(signature_hash=signature_hash)
        if not signatures:
            raise CommandError("No signatures matching hash '%s'" % signature_hash)
        datums = PerformanceDatum.objects.filter(signature__in=signatures)
        datums.delete()
        signatures.delete()
