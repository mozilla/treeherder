from django.core.management.base import BaseCommand

from treeherder.etl.files_bugzilla_map import ProductSecurityGroupProcess


class Command(BaseCommand):
    """Management command to manually update security groups for bugzilla products"""

    def handle(self, *args, **options):
        process = ProductSecurityGroupProcess()
        process.run()
