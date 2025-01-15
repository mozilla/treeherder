"""IMPORTANT!
This subcommand isn't intended for use on any non-local
dev environments. Any attempt to configure it otherwise
is considered a known and unapproved risk.

The subcommand's sole purpose is to act as a smoke test
harness that quickly does an end-to-end check over the
functionality of the `BackfillTool`.
"""

from django.core.management.base import BaseCommand

from treeherder.perf.auto_perf_sheriffing.factories import backfill_tool_factory


class Command(BaseCommand):
    help = "Backfill missing performance jobs"

    def add_arguments(self, parser):
        parser.add_argument(
            "job",
            action="store",
            type=str,
            help="Performance job to backfill from",
            metavar="JOB_ID",
        )

    def handle(self, *args, **options):
        job_id = options["job"]

        backfill_tool = backfill_tool_factory()
        task_id = backfill_tool.backfill_job(job_id)

        print(f"Task id {task_id} created when backfilled job id {job_id}")
