import json
import logging
import os

from django.core.management.base import BaseCommand

from treeherder.etl.job_loader import JobLoader
from treeherder.etl.taskcluster_pulse.handler import (fetchTask,
                                                      handleMessage)
from treeherder.services.pulse import (UpdateJobFixtures,
                                       job_sources,
                                       prepare_consumer,
                                       pulse_conn)

logger = logging.getLogger(__name__)
tests_path = os.path.join('tests', 'sample_data', 'pulse_consumer')


class Command(BaseCommand):
    """
    Management command to read jobs from Pulse and store it as test fixtures
    """
    help = "Read jobs and store it as test fixtures."

    def handle(self, *args, **options):
        UpdateJobFixtures.maxMessages = 100
        self.stdout.write("The Pulse consumer will consume {number} messages".format(number=UpdateJobFixtures.maxMessages))
        with pulse_conn as connection:
            consumer = prepare_consumer(
                connection,
                UpdateJobFixtures,
                job_sources,
                lambda key: "#.{}".format(key),
            )

            try:
                consumer.run()
            except Exception:
                tc_messages = {}
                tc_tasks = {}
                th_jobs = {}
                jl = JobLoader()

                for message in consumer.messages:
                    taskId = message["payload"]["status"]["taskId"]
                    task = fetchTask(taskId)
                    runs = handleMessage(message, task)
                    for run in runs:
                        try:
                            th_jobs[taskId] = jl.transform(run)
                            tc_messages[taskId] = message
                            tc_tasks[taskId] = task
                        except Exception:
                            logger.info('Issue validating this message: %s', run)
                logger.info("Updating Taskcluster jobs: %s entries", len(tc_messages))
                with open(os.path.join(tests_path, 'taskcluster_pulse_messages.json'), 'w') as fh:
                    # Write new line at the end to satisfy prettier
                    fh.write(json.dumps(tc_messages, sort_keys=True, indent=2) + "\n")

                logger.info("Updating Taskcluster task: %s entries", len(tc_tasks))
                with open(os.path.join(tests_path, 'taskcluster_tasks.json'), 'w') as fh:
                    # Write new line at the end to satisfy prettier
                    fh.write(json.dumps(tc_tasks, sort_keys=True, indent=2) + "\n")

                logger.info("Updating transformed messages: %s entries", len(th_jobs))
                with open(os.path.join(tests_path, 'taskcluster_transformed_jobs.json'), 'w') as fh:
                    # Write new line at the end to satisfy prettier
                    fh.write(json.dumps(th_jobs, sort_keys=True, indent=2) + "\n")
                self.stdout.write("Pulse Job listening stopped...")
