from django.core.management.base import BaseCommand

from treeherder.changelog.tasks import update_changelog


class Command(BaseCommand):
    help = """
    Update the changelog manually.

    This is mostly useful for testing
    """

    def add_arguments(self, parser):
        parser.add_argument("--days", help="Number of days to look at", type=int, default=1)

    def handle(self, *args, **options):
        update_changelog(options["days"])
