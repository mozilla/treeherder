from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from treeherder.perf.models import PerformanceAlert, PerformanceDatum, PerformanceSignature

RAPTOR_TP6_SUBTESTS = 'raptor-tp6-subtests'
USE_CASES = [RAPTOR_TP6_SUBTESTS]


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
            '--from',
            action='append',
            help='Original signature (specify multiple times to get multiple signatures)',
        )
        parser.add_argument(
            '--to',
            action='append',
            help='New signature we want to move performance data to '
            '(specify multiple times to get multiple signatures)',
        )
        parser.add_argument(
            '--for',
            action='store',
            choices=USE_CASES,
            metavar='USE CASE',
            help='''Rename "old" Raptor tp6 subtests, by pointing perf alerts & datum to new signatures.
                 Cannot be used in conjunction with --from/--to arguments.
                 Available use cases: {}'''.format(
                ','.join(USE_CASES)
            ),
        )
        parser.add_argument(
            '--keep-leftovers',
            action='store_true',
            help='Keep database rows even if they become useless after the script runs',
        )

    def handle(self, *args, **options):
        from_signatures = options['from']
        to_signatures = options['to']
        use_case = options['for']
        keep_leftovers = options['keep_leftovers']

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

    def fetch_signature_pairs(self, use_case):
        if use_case == RAPTOR_TP6_SUBTESTS:
            return self.fetch_tp6_signature_pairs()

    def fetch_tp6_signature_pairs(self):
        query_for_signature_pairs = """
            SELECT
                old_signature.id AS old_id,
                new_signature.id AS new_id
            FROM
                performance_signature AS old_signature,
                performance_signature AS new_signature
            WHERE
               old_signature.framework_id = 10 AND
               old_signature.suite LIKE '{tp6_name_pattern}' AND
               old_signature.test LIKE '{tp6_name_pattern}' AND
               old_signature.parent_signature_id IS NOT NULL AND
               old_signature.repository_id IN ({mozilla_central}, {mozilla_inbound}, {mozilla_beta}, {autoland}) AND

               new_signature.test NOT LIKE '{tp6_name_pattern}' AND

               INSTR(old_signature.test, new_signature.test) <> 0 AND
               old_signature.parent_signature_id = new_signature.parent_signature_id AND
               old_signature.suite = new_signature.suite AND
               old_signature.repository_id = new_signature.repository_id AND
               old_signature.framework_id = new_signature.framework_id AND
               old_signature.platform_id = new_signature.platform_id AND
               old_signature.option_collection_id = new_signature.option_collection_id AND
               old_signature.extra_options = new_signature.extra_options AND
               old_signature.lower_is_better = new_signature.lower_is_better AND
               old_signature.has_subtests = new_signature.has_subtests""".format(
            tp6_name_pattern='raptor-tp6%',
            mozilla_central=self.mozilla_central,
            mozilla_inbound=self.mozilla_inbound,
            mozilla_beta=self.mozilla_beta,
            autoland=self.autoland,
        )

        with connection.cursor() as cursor:
            cursor.execute(query_for_signature_pairs)
            signature_pairs = cursor.fetchall()
        return signature_pairs

    def remove_signatures(self, signatures):
        PerformanceSignature.objects.filter(id__in=signatures).delete()

    def reassign(self, signature_pairs):
        with transaction.atomic():
            for from_sign, to_sign in signature_pairs:
                PerformanceDatum.objects.filter(signature_id=from_sign).update(signature_id=to_sign)
                PerformanceAlert.objects.filter(series_signature_id=from_sign).update(
                    series_signature_id=to_sign
                )
