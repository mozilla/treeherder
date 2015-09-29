from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.perf.models import PerformanceFramework


class Command(BaseCommand):

    help = "Add a performance framework to treeherder"
    args = '<framework>'

    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError("Need to (only) specify the unique identifier for framework")
        PerformanceFramework.objects.create(name=args[0])
