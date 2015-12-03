from optparse import make_option

from django.core.management.base import BaseCommand

from treeherder.model.models import (Datasource,
                                     Repository)
from treeherder.perf.models import PerformanceSignature


class Command(BaseCommand):
    help = "make subtest store as foreign key"
    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='append',
                    dest='project',
                    help='Filter deletion to particular project(s)',
                    type='string'),
    )

    def handle(self, *args, **options):
        if options['project']:
            projects = options['project']
        else:
            projects = Datasource.objects.values_list('project', flat=True)

        for project in projects:
            print project
            try:
                repository = Repository.objects.get(name=project)
            except:
                continue
            signatures = PerformanceSignature.objects.filter(
                repository=repository
            )
            for signature in signatures:
                if signature.extra_properties.get('subtest_signatures'):
                    subtest_signatures = signature.extra_properties.pop('subtest_signatures')
                    subtests = PerformanceSignature.objects.filter(
                        signature_hash__in=subtest_signatures)
                    signature.subtests.add(*subtests)
