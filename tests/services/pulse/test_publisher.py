from treeherder.services.pulse import publish_job_action


def test_publish_job_action(pulse_action_consumer):
    publish_job_action(
        version=1,
        build_system_type="test build system",
        project="a project",
        action="retrigger",
        job_guid="guid",
        job_id=1,
        requester="the tester"
    )

    message = pulse_action_consumer.get(block=True, timeout=2)

    assert message.payload["action"] == "retrigger"
    assert message.payload["project"] == "a project"
