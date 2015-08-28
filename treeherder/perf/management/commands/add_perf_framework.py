from treeherder.perf.models import PerformanceFramework

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):

    help = "Add a performance framework to treeherder"
    args = '<framework>'

    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError("Need to (only) specify unique identifier for framework")
        pf = PerformanceFramework.objects.create(name=args[0])
        pf.save()
