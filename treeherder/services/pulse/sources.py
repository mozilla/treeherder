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
destinations = env.list("PULSE_JOB_DESTINATIONS", default=[
    "#",
    # "production",
    # "staging",
    # "tc-treeherder",
])


# Get Job ingestion source locations.

# Specifies the Pulse exchanges Treeherder will ingest data from for Job data.
# This list will be updated as new applications come online that Treeherder
# supports. Treeherder will subscribe with routing keys that are all
# combinations of ``project`` and ``destination`` in the form of:
# <destination>.<project> Wildcards such as ``#`` and ``*`` are supported for
# either field.
job_sources = [{
    "exchange": exchange,
    "projects": projects,
    "destinations": destinations,
} for exchange in exchanges]


# Get Push ingestion source locations.
# Specifies the Pulse exchanges Treeherder will ingest data from for Push data.
push_sources = env.json(
    "PULSE_PUSH_SOURCES",
    default=[{
        "exchange": "exchange/taskcluster-github/v1/push",
        "routing_keys": ['#'],
    }, {
        "exchange": "exchange/taskcluster-github/v1/pull-request",
        "routing_keys": ['#'],
    }, {
        "exchange": "exchange/hgpushes/v1",
        "routing_keys": ["#"]
    }],
)
