import time
from optparse import make_option

from django.core.management.base import BaseCommand

from treeherder.model.models import (Datasource,
                                     Repository)
from treeherder.perf.models import PerformanceSignature


class Command(BaseCommand):

    help = "Remove single test summaries"
    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='append',
                    dest='project',
                    help='Filter deletion to particular project(s)',
                    type='string'),
        make_option('--interval',
                    dest='interval',
                    help='Wait specified interval between deletions',
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
            signatures = PerformanceSignature.objects.filter(
                repository=repository)
            signatures_to_remove = []
            for signature in signatures:
                if len(signature.extra_properties.get('subtest_signatures',
                                                      [])) == 1:
                    signatures_to_remove.append(signature)

            for signature in signatures_to_remove:
                signature.delete()  # all datum objects referencing signature should be removed too
                time.sleep(options['interval'])
