from django.core.management.base import BaseCommand

from treeherder.etl.bugzilla import BzApiBugProcess


class Command(BaseCommand):
    """Management command to manually update bugscache from bugzilla"""

    def handle(self, *args, **options):
        process = BzApiBugProcess()
        process.run()
