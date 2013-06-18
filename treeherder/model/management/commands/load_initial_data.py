from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = "Load initial data into the master db"

    def handle(self, *args, **options):
        call_command('loaddata',
                     'repository_group',
                     'repository',
                     'job_group',
                     'job_type')
