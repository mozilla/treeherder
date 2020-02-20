from django.core.management.base import BaseCommand

from treeherder.perf.investigation_aids import (BackfillTool,
                                                TaskclusterModel)


class Command(BaseCommand):
    help = "Backfill missing performance jobs"

    def add_arguments(self, parser):
        parser.add_argument(
            'job',
            action='store',
            type=str,
            help="Performance job to backfill from",
            metavar='JOB_ID',
        )

    def handle(self, *args, **options):
        job_id = options['job']

        taskcluster_model = TaskclusterModel()
        backfill_tool = BackfillTool(taskcluster_model)

        task_id = backfill_tool.backfill_job(job_id)

        print(f"Task id {task_id} created when backfilled job id {job_id}")
