from treeherder.model.pulse_publisher import (Exchange,
                                              Key,
                                              PulsePublisher)


class TreeherderPublisher(PulsePublisher):
    title = "TreeHerder Exchanges"
    description = """
        Exchanges for services that wants to know what shows up on TreeHerder.
    """
    exchange_prefix = "v1/"

    new_result_set = Exchange(
        exchange='new-result-set',
        title="New Result-Set Messages",
        description="""
            Whenever a new result-set is created a message featuring the
            `revision_hash` is published on this exchange.
        """,
        routing_keys=[
            Key(
                name='project',
                summary="Project (or branch) that this result-set concerns"
            ),
            Key(
                name='revision_hash',
                summary="result-set identifier for the message"
            )
        ],
        schema="https://treeherder.mozilla.org/schemas/v1/resultset-message.json#"
    )

    resultset_action = Exchange(
        exchange="resultset-actions",
        title="Actions issued by resultset",
        description="""
            There are actions which can be done to a resultset
            (eg: trigger_missing_jobs), they are published on this exchange
        """,
        routing_keys=[
            Key(
                name='project',
                summary="Project (or branch) that this result-set belongs to"
            ),
            Key(
                name="action",
                summary="Type of action issued (i.e. trigger_missing_jobs)"
            ),
        ],
        schema="https://treeherder.mozilla.org/schemas/v1/resultset-action-message.json#"
    )

    job_action = Exchange(
        exchange="job-actions",
        title="Actions issued by jobs",
        description="""
            There are a number of actions which can be done to a job
            (retrigger/cancel) they are published on this exchange
        """,
        routing_keys=[
            Key(
                name="build_system_type",
                summary="Build system which created job (i.e. buildbot)"
            ),
            Key(
                name="project",
                summary="Project (i.e. try) which this job belongs to"
            ),
            Key(
                name="action",
                summary="Type of action issued (i.e. cancel)"
            )
        ],
        schema="https://treeherder.mozilla.org/schemas/v1/job-action-message.json#"
    )
