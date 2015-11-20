from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.model import models
from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import PerformanceSignature


class Command(BaseCommand):

    help = """
    Bulk-create alerts for a set of signatures in a specific project

    This is mostly useful for testing
    """

    def add_arguments(self, parser):
        parser.add_argument(
            '--project', action='append',
            help='Project to get signatures from (specify multiple times to '
            'get multiple projects')
        parser.add_argument(
            '--signature', action='append',
            help='Signature hashes to process, defaults to all non-subtests')

    def handle(self, *args, **options):
        if not options['project']:
            raise CommandError("Must specify at least one project with "
                               "--project")
        for project in options['project']:
            repository = models.Repository.objects.get(name=project)

            signatures = PerformanceSignature.objects.filter(
                repository=repository)

            if options['signature']:
                signatures_to_process = signatures.filter(
                    signature_hash__in=options['signature'])
            else:
                hashes_to_ignore = set()
                # if doing everything, only handle series which are not a
                # subtest of another (we should alert only the parent series
                # in that case)
                for signature in signatures:
                    # Don't alert on subtests which have a summary
                    hashes_to_ignore.update(
                        signature.extra_properties.get('subtest_signatures',
                                                       []))
                signatures_to_process = [signature for signature in signatures
                                         if signature.signature_hash not in
                                         hashes_to_ignore]

            for signature in signatures_to_process:
                generate_new_alerts_in_series(signature)
