import environ

env = environ.Env()


def get_job_sources():
    """
    Get Job ingestion source locations.

    Specifies the Pulse exchanges Treeherder will ingest data from for Job
    data.  This list will be updated as new applications come online that
    Treeherder supports. Treeherder will subscribe with routing keys that are
    all combinations of ``project`` and ``destination`` in the form of:
    <destination>.<project> Wildcards such as ``#`` and ``*`` are supported for
    either field.
    """
    sources = env.json(
        "PULSE_DATA_INGESTION_SOURCES",
        default=[
            {
                "exchange": "exchange/taskcluster-treeherder/v1/jobs",
                "projects": [
                    '#'
                    # some specific repos TC can ingest from
                    # 'mozilla-central.#',
                    # 'mozilla-inbound.#'
                ],
                "destinations": [
                    '#'
                    # 'production',
                    # 'staging'
                ],
            },
            # ... other CI systems
        ],
    )

    return sources


def get_push_sources():
    """
    Get Push ingestion source locations.

    Specifies the Pulse exchanges Treeherder will ingest data from for Push
    data.
    """
    sources = env.json(
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

    return sources


job_sources = get_job_sources()
push_sources = get_push_sources()
