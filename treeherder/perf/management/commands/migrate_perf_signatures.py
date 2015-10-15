import time
from optparse import make_option

from django.core.management.base import BaseCommand

from treeherder.model.models import (Datasource,
                                     Repository)
from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceSignature)


class Command(BaseCommand):

    help = "Migrate performance signatures"
    args = '<framework>'
    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='append',
                    dest='project',
                    help='Filter migration to particular project(s)',
                    type='string'),
        make_option('--signature',
                    action='append',
                    dest='signature',
                    help='Filter migration to particular signature(s)',
                    type='string'),
        make_option('--interval',
                    dest='interval',
                    help='Wait specified interval between signature migrations',
                    type='float',
                    default=0.0)
    )

    def handle(self, *args, **options):
        if options['project']:
            projects = options['project']
        else:
            projects = Datasource.objects.values_list('project', flat=True)

        for project in projects:
            print project
            repository = Repository.objects.get(name=project)
            hashes_to_migrate = set(PerformanceDatum.objects.filter(
                repository=repository,
                signature__repository__isnull=True).values_list(
                    'signature__signature_hash', flat=True).distinct())
            if options['signature']:
                hashes_to_migrate &= set(options['signature'])

            for hash in hashes_to_migrate:
                print hash
                old_signature = PerformanceSignature.objects.get(
                    repository__isnull=True, signature_hash=hash)
                datums = PerformanceDatum.objects.filter(
                    repository=repository, signature=old_signature).order_by('push_timestamp')
                new_signature, _ = PerformanceSignature.objects.get_or_create(
                    repository=repository,
                    signature_hash=old_signature.signature_hash,
                    defaults={
                        'test': old_signature.test,
                        'suite': old_signature.suite,
                        'option_collection': old_signature.option_collection,
                        'platform': old_signature.platform,
                        'framework': old_signature.framework,
                        'extra_properties': old_signature.extra_properties,
                        'last_updated': datums.last().push_timestamp
                    })
                datums.update(signature=new_signature)
                time.sleep(options['interval'])
