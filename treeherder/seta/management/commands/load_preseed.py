from django.core.management.base import BaseCommand

from treeherder.seta.preseed import load_preseed


class Command(BaseCommand):
    help = 'Update job priority table with data based on preseed.json'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def add_arguments(self, parser):
        parser.add_argument(
            "--validate",
            action="store_true",
            help="This will validate that all entries in preseed.json are valid"
        )

    def handle(self, *args, **options):
        load_preseed(options.get("validate"))
