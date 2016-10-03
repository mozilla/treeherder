from django.core.management.base import BaseCommand

from treeherder.seta.preseed import load_preseed


class Command(BaseCommand):
    help = 'Update job priority table with data based on preseed.json'

    def __init__(self, *args, **kwargs):
        super(Command, self).__init__(*args, **kwargs)

    def handle(self, *args, **options):
        load_preseed()
