import logging

from django.core.management.base import BaseCommand

from treeherder.etl.runnable_jobs import RunnableJobsProcess
from treeherder.seta.models import JobPriority
from treeherder.seta.preseed import load_preseed
from treeherder.seta.update_job_priority import update_job_priority_table

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Initialize or update SETA data; It causes no harm to run on production'

    def __init__(self, *args, **kwargs):
        super(Command, self).__init__(*args, **kwargs)

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear-job-priority-table',
            action='store_true',
            dest='clear_jp_table',
            default=False,
            help='Delete all entries in the JobPriority table.',
        )

    def clear_job_priority_table(self):
        logger.info('Number of items in table: %d', JobPriority.objects.count())
        logger.info('Deleting all entries in the job priority table.')
        JobPriority.objects.all().delete()
        logger.info('Number of items in table: %d', JobPriority.objects.count())

    def initialize_seta(self):
        logger.info('Updating runnable jobs table (this will take few minutes).')
        RunnableJobsProcess().run()
        logger.info('Updating JobPriority table.')
        logger.info('Number of items in table: %d', JobPriority.objects.count())
        update_job_priority_table()
        logger.info('Loading preseed table.')
        logger.info('Number of items in table: %d', JobPriority.objects.count())
        load_preseed()
        logger.info('Number of items in table: %d', JobPriority.objects.count())

    def handle(self, *args, **options):
        if options['clear_jp_table']:
            self.clear_job_priority_table()
        else:
            self.initialize_seta()
