import environ

env = environ.Env()


exchanges = env.list("PULSE_JOB_EXCHANGES", default=[
    "exchange/taskcluster-treeherder/v1/jobs",
    # "exchange/fxtesteng/jobs",
    # ... other CI systems
])
projects = env.list("PULSE_JOB_PROJECTS", default=[
    "#",
    # some specific repos TC can ingest from
    # "mozilla-central.#",
    # "mozilla-inbound.#",
])


# Specifies the Pulse exchanges Treeherder will ingest data from for Jobs. This
# list will be updated as new applications come online that Treeherder
# supports.  Treeherder will subscribe with routing keys that are the project
# names.  Wildcards such as ``#`` and ``*`` are supported for the project
# field.
job_sources = [{
    "exchange": exchange,
    "projects": projects,
} for exchange in exchanges]


# Specifies the Pulse exchanges Treeherder will ingest data from for Push data.
# Routing keys are specified after a period ("."), separated by commas (",").
push_sources = [
    "exchange/taskcluster-github/v1/push.#",
    "exchange/taskcluster-github/v1/pull-request.#",
    "exchange/hgpushes/v1.#",
]
