from django.core.management.base import BaseCommand

from treeherder.seta.analyze_failures import AnalyzeFailures

from treeherder.seta.models import JobPriority

from treeherder.seta.preseed import load_preseed


class Command(BaseCommand):
    help = 'Erase all JobPriority entries and reset SETA'

    def __init__(self, *args, **kwargs):
        super(Command, self).__init__(*args, **kwargs)

    def handle(self, *args, **options):
        JobPriority.objects.all().delete()
        AnalyzeFailures(**options).run()
        load_preseed()
