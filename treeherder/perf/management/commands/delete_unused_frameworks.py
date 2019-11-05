from django.core.management.base import BaseCommand

from treeherder.perf.models import PerformanceFramework


class Command(BaseCommand):
    help = "Cascade delete old & unused performance frameworks from database. " \
           "Note: this will remove all related rows (performance_alert_summary, performance_alert, " \
           "performance_signature, performance_bug_template etc)"

    def handle(self, *args, **options):
        (PerformanceFramework.objects
         .filter(name__in=['talos-aws', 'hasal', 'servo-perf', 'autophone'])
         .delete())
