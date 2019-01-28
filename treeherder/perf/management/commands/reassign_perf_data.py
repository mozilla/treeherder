from django.core.management.base import (BaseCommand,
                                         CommandError)
from django.db import transaction

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceDatum)


class Command(BaseCommand):
    help = """
    Moves performance data from an old signature to
    a new one.
    Useful when renaming perf tests, as it allows
    to combine old signature data with new one.
    """

    def add_arguments(self, parser):
        parser.add_argument(
            '--from',
            action='append',
            help='Original signature (specify multiple times to get multiple signatures)'
        )
        parser.add_argument(
            '--to',
            action='append',
            help='New signature we want to move performance data to '
                 '(specify multiple times to get multiple signature)'
        )

    def handle(self, *args, **options):
        from_signatures = options['from']
        to_signatures = options['to']

        if not (from_signatures and to_signatures):
            raise CommandError("Must specify both old and new signatures")
        if len(from_signatures) != len(to_signatures):
            raise CommandError("Each old signature must have a corresponding new one")

        with transaction.atomic():
            for from_sign, to_sign in zip(from_signatures, to_signatures):
                PerformanceDatum.objects.filter(signature_id=from_sign).update(signature_id=to_sign)
                PerformanceAlert.objects.filter(series_signature_id=from_sign).update(series_signature_id=to_sign)
