from treeherder.model.pulse_publisher import (Exchange,
                                              Key,
                                              PulsePublisher)


class TreeherderPublisher(PulsePublisher):
    title = "TreeHerder Exchanges"
    description = """
        Exchanges for services that wants to know what shows up on TreeHerder.
    """
    exchange_prefix = "v1/"

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
