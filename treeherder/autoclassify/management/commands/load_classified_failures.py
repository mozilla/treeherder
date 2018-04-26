from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Load classified failure data into the db'

    def handle(self, *args, **options):
        tables = [
            'build_platform',
            'failure_classification',
            'job_group',
            'job_type',
            'machine_platform',
            'machine',
            'product',
            'repository_group',
            'repository',
            'push',
            'reference_data_signatures',

            'failure_line',
            'job',
            'text_log_step',
            'text_log_error',
        ]
        for table in tables:
            call_command('loaddata', 'dumps/{}.json'.format(table))
