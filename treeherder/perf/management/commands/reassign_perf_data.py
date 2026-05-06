from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceDatum,
    PerformanceSignature,
)


class Command(BaseCommand):
    help = """
    Moves performance data from an old signature to
    a new one.
    Useful when renaming perf tests, as it allows
    to combine old signature data with new one.
    """

    # repository ids Perf sheriffs are
    # daily interacting with
    mozilla_central = 1
    mozilla_inbound = 2
    mozilla_beta = 6
    autoland = 77

    def add_arguments(self, parser):
        parser.add_argument(
            "--from",
            action="append",
            help="Original signature (specify multiple times to get multiple signatures)",
        )
        parser.add_argument(
            "--to",
            action="append",
            help="New signature we want to move performance data to "
            "(specify multiple times to get multiple signatures)",
        )
        parser.add_argument(
            "--keep-leftovers",
            action="store_true",
            help="Keep database rows even if they become useless after the script runs",
        )

    def handle(self, *args, **options):
        from_signatures = options["from"]
        to_signatures = options["to"]
        use_case = options["for"]
        keep_leftovers = options["keep_leftovers"]

        self.validate_arguments(from_signatures, to_signatures, use_case)

        if use_case:
            signature_pairs = self.fetch_signature_pairs(use_case)
        else:
            signature_pairs = zip(from_signatures, to_signatures)

        with transaction.atomic():
            self.reassign(signature_pairs)
            if not keep_leftovers:
                old_signatures = [old_signature for old_signature, _ in signature_pairs]
                self.remove_signatures(old_signatures)

    def validate_arguments(self, from_signatures, to_signatures, use_case):
        arguments = [from_signatures, to_signatures, use_case]
        if all(arguments) or not any(arguments):
            raise CommandError("Use either --for or --from/--to combo")

        if not use_case:
            # --from/--to combo
            if len(from_signatures) != len(to_signatures):
                raise CommandError("Each old signature must have a corresponding new one")

    def remove_signatures(self, signatures):
        PerformanceSignature.objects.filter(id__in=signatures).delete()

    def reassign(self, signature_pairs):
        with transaction.atomic():
            for from_sign, to_sign in signature_pairs:
                PerformanceDatum.objects.filter(signature_id=from_sign).update(signature_id=to_sign)
                PerformanceAlert.objects.filter(series_signature_id=from_sign).update(
                    series_signature_id=to_sign
                )
