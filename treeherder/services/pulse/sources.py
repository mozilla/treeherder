"""
Job and Push sources

Both source types define an exchange path followed by one or more routing key
parts. Routing keys are specified after a period (".") separated by colons
(":"). Routing keys use a colon separator to avoid problems with defining
multiple push sources in an environment variable which are comma separated.
"""
import environ

env = environ.Env()


# Specifies the Pulse exchanges Treeherder will ingest data from for Jobs.
# Projects specified after the period (".") delimiter and will be combined with
# the wildcard ("#") when used in prepare_consumer function when called by
# pulse_listener_jobs.
job_sources = env.list(
    "PULSE_JOB_SOURCES",
    default=[
        "exchange/taskcluster-queue/v1/task-pending.#",
        "exchange/taskcluster-queue/v1/task-running.#",
        "exchange/taskcluster-queue/v1/task-completed.#",
        "exchange/taskcluster-queue/v1/task-failed.#",
        "exchange/taskcluster-queue/v1/task-exception.#",
    ],
)


# Specifies the Pulse exchanges Treeherder will ingest data from for Push data.
push_sources = [
    "exchange/taskcluster-github/v1/push.#",
    "exchange/taskcluster-github/v1/pull-request.#",
    "exchange/hgpushes/v1.#",
]
