import logging
import time
from concurrent.futures import ProcessPoolExecutor

from django.core.management.base import BaseCommand
from django.db import connection

from treeherder.log_parser.crossreference import crossreference_job
from treeherder.model.models import Job

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Backfill crossreference_error_lines data'

    def handle(self, *args, **options):
        logger.debug("Backfill crossreference error lines command")

        with connection.cursor() as c:
            c.execute("""SELECT id FROM job ORDER by ID DESC LIMIT 1""")
            max_job_id = c.fetchone()[0]
            c.execute("""SELECT id FROM job ORDER by ID ASC LIMIT 1""")
            min_job_id = c.fetchone()[0]

            logger.info("Maximum job id %i", max_job_id)
            logger.info("Minimum job id %i", min_job_id)

            delta = 100000
            job_id = max_job_id

            start_time = time.time()

            first_processed = None
            total_jobs = None

        while job_id > min_job_id:
            job_id -= delta

            connection.connect()
            with connection.cursor() as c:
                c.execute(
                    """SELECT job.id FROM job
                INNER JOIN text_log_step ON text_log_step.job_id = job.id
                INNER JOIN text_log_error as tle ON tle.step_id = text_log_step.id
                INNER JOIN failure_line ON job.guid = failure_line.job_guid
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM text_log_error
                    INNER JOIN text_log_error_metadata
                      ON text_log_error.id = text_log_error_metadata.text_log_error_id
                    JOIN text_log_step
                      ON text_log_step.id = text_log_error.step_id
                    WHERE text_log_step.job_id = job.id) AND
                  job.id > %s AND
                  job.result NOT IN ('success', 'skipped', 'retry', 'usercancel', 'unknown', 'superseded')
                GROUP BY job.id
                ORDER BY job.id DESC;""",
                    [job_id],
                )
                rows = c.fetchall()

            connection.close()

            if first_processed is None and rows:
                first_processed = rows[0][0]
                total_jobs = float(first_processed - min_job_id)

            logger.info("Found %i rows", len(rows))

            with ProcessPoolExecutor(4) as executor:
                executor.map(_crossreference_job, (row[0] for row in rows))

            now = time.time()
            fraction_complete = float(first_processed - job_id) / total_jobs
            time_elapsed = now - start_time
            total_time = time_elapsed / fraction_complete
            time_remaining = total_time - time_elapsed
            logger.info("Estimated %i seconds remaining", time_remaining)


def _crossreference_job(job_id):
    try:
        job = Job.objects.get(id=job_id)
        logger.info("Running crossreference for job %s that had status %s", job.id, job.result)
        job.autoclassify_status = 0
        job.save()
        crossreference_job(job)
    except Exception:
        import traceback

        traceback.print_exc()
