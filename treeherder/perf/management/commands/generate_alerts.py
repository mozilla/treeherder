from optparse import make_option

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

    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='append',
                    help='Project to get signatures from (specify multiple times to get multiple projects'),
        make_option('--signature',
                    action='store',
                    help='Signature hash to process, defaults to all non-subtests')
    )

    def handle(self, *args, **options):
        if not options['project']:
            raise CommandError("Must specify at least one project with "
                               "--project")

        for project in options['project']:
            repository = models.Repository.objects.get(name=project)

            signatures = PerformanceSignature.objects.filter(
                repository=repository)

            if options['signature']:
                signature_hashes = [options['signature']]
                signature_ids = PerformanceSignature.objects.filter(
                    signature_hash__in=signature_hashes).values_list('id',
                                                                     flat=True)
                signatures_to_process = signatures.filter(id__in=list(signature_ids))
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
