from django.core.management.base import BaseCommand

from treeherder.extract.extract_alerts import ExtractAlerts


class Command(BaseCommand):
    """Management command to extract alerts"""

    help = "Extract recent alerts from Treeherder, and push them to BigQuery"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action='store_true', dest="force", help="Ignore changed schema"
        )
        parser.add_argument(
            "--restart",
            action='store_true',
            dest="restart",
            help="start extraction from the beginning",
        )
        parser.add_argument(
            "--merge",
            action='store_true',
            dest="merge",
            help="merge shards at startup (so previous data is available)",
        )

    def handle(self, *args, **options):
        ExtractAlerts().run(
            force=options.get("force"), restart=options.get("restart"), merge=options.get("merge")
        )
