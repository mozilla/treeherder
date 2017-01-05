from django.core.management.base import BaseCommand

from treeherder.etl.runnable_jobs import RunnableJobsProcess


class Command(BaseCommand):
    help = 'Populate the runnable_jobs API'

    def __init__(self, *args, **kwargs):
        super(Command, self).__init__(*args, **kwargs)

    def handle(self, *args, **options):
        RunnableJobsProcess().run()
