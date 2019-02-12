from django.core.management.base import (BaseCommand,
                                         CommandError)
from django.db import (connection,
                       transaction)

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceDatum)

RAPTOR_TP6_SUBTESTS = 'raptor-tp6-subtests'
USE_CASES = [RAPTOR_TP6_SUBTESTS]


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
                 '(specify multiple times to get multiple signatures)'
        )
        parser.add_argument(
            '--for',
            action='store',
            choices=USE_CASES,
            metavar='USE CASE',
            help='''Rename "old" Raptor tp6 subtests, by pointing perf alerts & datum to new signatures.
                 Cannot be used in conjunction with --from/--to arguments.
                 Available use cases: {}'''.format(','.join(USE_CASES))
        )

    def handle(self, *args, **options):
        from_signatures = options['from']
        to_signatures = options['to']
        use_case = options['for']

        self.validate_arguments(from_signatures, to_signatures, use_case)

        if use_case:
            self.reassign_perf_tests(use_case)
        else:
            self.reassign(zip(from_signatures, to_signatures))

    def validate_arguments(self, from_signatures, to_signatures, perf_framework):
        arguments = [from_signatures, to_signatures, perf_framework]
        if all(arguments) or not any(arguments):
            raise CommandError("Use either --for or --from/--to combo")

        if not perf_framework:
            # --from/--to combo
            if len(from_signatures) != len(to_signatures):
                raise CommandError("Each old signature must have a corresponding new one")

    def reassign_perf_tests(self, use_case):
        if use_case == RAPTOR_TP6_SUBTESTS:
            signature_pairs = self.fetch_tp6_signature_pairs()
            self.reassign(signature_pairs)

    def fetch_tp6_signature_pairs(self):
        with connection.cursor() as cursor:
            cursor.execute("""
            SELECT
                old_signature.id AS old_id,
                new_signature.id AS new_id
            FROM
                performance_signature AS old_signature,
                performance_signature AS new_signature
            WHERE
               old_signature.framework_id = 10 AND
               old_signature.suite LIKE 'raptor-tp6%' AND
               old_signature.test LIKE 'raptor-tp6%' AND
               old_signature.parent_signature_id IS NOT NULL AND
               old_signature.repository_id IN (1, 2, 6, 77) AND

               new_signature.test NOT LIKE 'raptor-tp6%' AND

               INSTR(old_signature.test, new_signature.test) <> 0 AND
               old_signature.parent_signature_id = new_signature.parent_signature_id AND
               old_signature.suite = new_signature.suite AND
               old_signature.repository_id = new_signature.repository_id AND
               old_signature.framework_id = new_signature.framework_id AND
               old_signature.platform_id = new_signature.platform_id AND
               old_signature.option_collection_id = new_signature.option_collection_id AND
               old_signature.extra_options = new_signature.extra_options AND
               old_signature.lower_is_better = new_signature.lower_is_better AND
               old_signature.has_subtests = new_signature.has_subtests""")
            signature_pairs = cursor.fetchall()
        return signature_pairs

    def reassign(self, signature_pairs):
        with transaction.atomic():
            for from_sign, to_sign in signature_pairs:
                PerformanceDatum.objects.filter(signature_id=from_sign).update(signature_id=to_sign)
                PerformanceAlert.objects.filter(series_signature_id=from_sign).update(series_signature_id=to_sign)
