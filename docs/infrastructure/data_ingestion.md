# Data Ingestion

## Ingestion Pipeline
Treeherder uses the [Celery](https://docs.celeryproject.org/en/stable/index.html) task queue software, with the RabbitMQ broker, for processing taskcluster data that is submitted to the [Pulse Guardian](https://pulseguardian.mozilla.org/) queues. It only subscribes to specific exchanges and only processes pushes and tasks for repositories that are defined in the repository.json [fixture](https://github.com/mozilla/treeherder/blob/master/treeherder/model/fixtures/repository.json). 

All of the code that listens for tasks and pushes, stores them, and kicks off log parsing can be found in the `treeherder/etl` directory. Specific Celery settings, such as pre-defined queues, are defined in [settings.py](https://github.com/mozilla/treeherder/blob/master/treeherder/config/settings.py#L301).

Treeherder executes `pulse_listener_pushes` and `pulse_listener_tasks` django commands in [entrypoint_prod](https://github.com/mozilla/treeherder/blob/master/docker/entrypoint_prod.sh#L27-L30) that listens to both the main firefox-ci cluster and the community clusters (credentials are stored in the PULSE_URL env variable). It adds tasks to the `store_pulse_pushes` and `store_pulse_jobs` queues for `worker_store_pulse_data` to process.

Once tasks are processed, the log parsing is scheduled, and depending on the status of the task and type of repository, it will be sent to different types of [log parsing queues](https://github.com/mozilla/treeherder/blob/master/treeherder/etl/jobs.py#L345-L360). 

The live backing log is parsed for a number of reasons - to extract and store performance data for tests that add PERFORMANCE_DATA objects in the logs and to extract and store failure lines for failed tasks. These failure lines are stored and displayed in the job details panel in the Treeherder jobs view, and are used by code sheriffs to classify intermittent failures against bugzilla bugs.

Troubleshooting steps for various data ingestion problems can be found [here](./troubleshooting.md#scenarios).

## Adding New Queues or Workers

Ensure that the docker-compose.yml, entrypoint_prod and settings.py files are updated. You'll also need to ensure that a new worker is added to the cloudOps repo. See [Managing scheduled tasks, celery queues and environment variable](./administration.md#managing-scheduled-tasks-celery-queues-and-environment-variables).



