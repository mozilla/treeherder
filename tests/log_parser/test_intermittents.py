import datetime

from treeherder.log_parser.intermittents import check_and_mark_intermittent
from treeherder.model.models import Group, GroupStatus, Job, JobLog, JobType, Push


def _make_job(repository, push, job_type, refdata, result, fc_id, guid):
    """Create a completed Job wired to the shared generic reference data."""
    return Job.objects.create(
        guid=guid,
        repository=repository,
        push=push,
        signature=refdata.signature,
        build_platform=refdata.build_platform,
        machine_platform=refdata.machine_platform,
        machine=refdata.machine,
        option_collection_hash=refdata.option_collection_hash,
        job_type=job_type,
        job_group=refdata.job_group,
        product=refdata.product,
        failure_classification_id=fc_id,
        who="test@example.com",
        reason="",
        result=result,
        state="completed",
        submit_time=push.time,
        start_time=push.time,
        end_time=push.time,
        tier=1,
    )


def test_check_and_mark_intermittent_marks_prior_failure(
    test_repository, generic_reference_data, failure_classifications
):
    """A group that ERROR'd on an earlier push but passes on the current push
    causes the earlier job to be marked intermittent (failure_classification 8).

    This characterizes the all_groups query in check_and_mark_intermittent so
    the repository-filter rewrite (which drops the push join) stays equivalent.
    """
    now = datetime.datetime.now()
    older_push = Push.objects.create(
        repository=test_repository,
        revision="a" * 40,
        author="test@example.com",
        time=now - datetime.timedelta(hours=1),
    )
    current_push = Push.objects.create(
        repository=test_repository,
        revision="b" * 40,
        author="test@example.com",
        time=now,
    )

    # A name with no trailing chunk number and no leading/trailing chars in
    # {-, c, f} so check_and_mark_intermittent's jtname normalization is a no-op.
    job_type = JobType.objects.create(name="test-linux1804-64/opt-mochitest-plain")

    failed_job = _make_job(
        test_repository,
        older_push,
        job_type,
        generic_reference_data,
        result="testfailed",
        fc_id=1,  # "not classified"
        guid="job-older",
    )
    passing_job = _make_job(
        test_repository,
        current_push,
        job_type,
        generic_reference_data,
        result="success",
        fc_id=1,
        guid="job-current",
    )

    group = Group.objects.create(name="/some/manifest.ini")

    failed_log = JobLog.objects.create(
        job=failed_job, name="errorsummary_json", url="http://log/1", status=JobLog.PARSED
    )
    passing_log = JobLog.objects.create(
        job=passing_job, name="errorsummary_json", url="http://log/2", status=JobLog.PARSED
    )

    GroupStatus.objects.create(
        status=GroupStatus.ERROR, duration=1, job_log=failed_log, group=group
    )
    GroupStatus.objects.create(status=GroupStatus.OK, duration=1, job_log=passing_log, group=group)

    check_and_mark_intermittent(passing_job.id)

    failed_job.refresh_from_db()
    passing_job.refresh_from_db()

    # The earlier failure is reclassified as a known intermittent (8); the
    # passing job (result=success) is left untouched by classify().
    assert failed_job.failure_classification_id == 8
    assert passing_job.failure_classification_id == 1
