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

        for from_sign, to_sign in zip(from_signatures, to_signatures):
            self.atomically_reassign_rows(
                [PerformanceDatum, PerformanceAlert],
                from_sign,
                to_sign)

    def atomically_reassign_rows(self, models, from_sign, to_sign):
        """
        :param models: table from which to reassign rows
        """
        with transaction.atomic():
            for model in models:
                model.objects.filter(signature_id=from_sign).update(signature_id=to_sign)
