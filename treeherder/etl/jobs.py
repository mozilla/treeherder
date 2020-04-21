import copy
import logging
import os
import time
from datetime import datetime
from hashlib import sha1

import newrelic.agent
from django.core.exceptions import ObjectDoesNotExist
from django.db.utils import IntegrityError

from treeherder.etl.artifact import serialize_artifact_json_blobs, store_job_artifacts
from treeherder.etl.common import get_guid_root
from treeherder.model.models import (
    BuildPlatform,
    FailureClassification,
    Job,
    JobGroup,
    JobLog,
    JobType,
    Machine,
    MachinePlatform,
    Option,
    OptionCollection,
    Product,
    Push,
    ReferenceDataSignatures,
    TaskclusterMetadata,
)

logger = logging.getLogger(__name__)


def _get_number(s):
    try:
        return int(s)
    except (ValueError, TypeError):
        return 0


def _remove_existing_jobs(data):
    """
    Remove jobs from data where we already have them in the same state.

    1. split the incoming jobs into pending, running and complete.
    2. fetch the ``job_guids`` from the db that are in the same state as they
       are in ``data``.
    3. build a new list of jobs in ``new_data`` that are not already in
       the db and pass that back.  It could end up empty at that point.
    """
    new_data = []

    guids = [datum['job']['job_guid'] for datum in data]
    state_map = {
        guid: state
        for (guid, state) in Job.objects.filter(guid__in=guids).values_list('guid', 'state')
    }

    for datum in data:
        job = datum['job']
        if not state_map.get(job['job_guid']):
            new_data.append(datum)
        else:
            # should not transition from running to pending,
            # or completed to any other state
            current_state = state_map[job['job_guid']]
            if current_state == 'completed' or (
                job['state'] == 'pending' and current_state == 'running'
            ):
                continue
            new_data.append(datum)

    return new_data


def _load_job(repository, job_datum, push_id):
    """
    Load a job into the treeherder database

    If the job is a ``retry`` the ``job_guid`` will have a special
    suffix on it.  But the matching ``pending``/``running`` job will not.
    So we append the suffixed ``job_guid`` to ``retry_job_guids``
    so that we can update the job_id_lookup later with the non-suffixed
    ``job_guid`` (root ``job_guid``). Then we can find the right
    ``pending``/``running`` job and update it with this ``retry`` job.
    """
    build_platform, _ = BuildPlatform.objects.get_or_create(
        os_name=job_datum.get('build_platform', {}).get('os_name', 'unknown'),
        platform=job_datum.get('build_platform', {}).get('platform', 'unknown'),
        architecture=job_datum.get('build_platform', {}).get('architecture', 'unknown'),
    )

    machine_platform, _ = MachinePlatform.objects.get_or_create(
        os_name=job_datum.get('machine_platform', {}).get('os_name', 'unknown'),
        platform=job_datum.get('machine_platform', {}).get('platform', 'unknown'),
        architecture=job_datum.get('machine_platform', {}).get('architecture', 'unknown'),
    )

    option_names = job_datum.get('option_collection', [])
    option_collection_hash = OptionCollection.calculate_hash(option_names)
    if not OptionCollection.objects.filter(option_collection_hash=option_collection_hash).exists():
        # in the unlikely event that we haven't seen this set of options
        # before, add the appropriate database rows
        options = []
        for option_name in option_names:
            option, _ = Option.objects.get_or_create(name=option_name)
            options.append(option)
        for option in options:
            OptionCollection.objects.create(
                option_collection_hash=option_collection_hash, option=option
            )

    machine, _ = Machine.objects.get_or_create(name=job_datum.get('machine', 'unknown'))

    job_type, _ = JobType.objects.get_or_create(
        symbol=job_datum.get('job_symbol') or 'unknown', name=job_datum.get('name') or 'unknown'
    )

    job_group, _ = JobGroup.objects.get_or_create(
        name=job_datum.get('group_name') or 'unknown',
        symbol=job_datum.get('group_symbol') or 'unknown',
    )

    product_name = job_datum.get('product_name', 'unknown')
    if not product_name.strip():
        product_name = 'unknown'
    product, _ = Product.objects.get_or_create(name=product_name)

    job_guid = job_datum['job_guid']
    job_guid = job_guid[0:50]

    who = job_datum.get('who') or 'unknown'
    who = who[0:50]

    reason = job_datum.get('reason') or 'unknown'
    reason = reason[0:125]

    state = job_datum.get('state') or 'unknown'
    state = state[0:25]

    build_system_type = job_datum.get('build_system_type', 'buildbot')

    reference_data_name = job_datum.get('reference_data_name', None)

    default_failure_classification = FailureClassification.objects.get(name='not classified')

    sh = sha1()
    sh.update(
        ''.join(
            map(
                str,
                [
                    build_system_type,
                    repository.name,
                    build_platform.os_name,
                    build_platform.platform,
                    build_platform.architecture,
                    machine_platform.os_name,
                    machine_platform.platform,
                    machine_platform.architecture,
                    job_group.name,
                    job_group.symbol,
                    job_type.name,
                    job_type.symbol,
                    option_collection_hash,
                    reference_data_name,
                ],
            )
        ).encode('utf-8')
    )
    signature_hash = sh.hexdigest()

    # Should be the buildername in the case of buildbot (if not provided
    # default to using the signature hash)
    if not reference_data_name:
        reference_data_name = signature_hash

    signature, _ = ReferenceDataSignatures.objects.get_or_create(
        name=reference_data_name,
        signature=signature_hash,
        build_system_type=build_system_type,
        repository=repository.name,
        defaults={
            'first_submission_timestamp': time.time(),
            'build_os_name': build_platform.os_name,
            'build_platform': build_platform.platform,
            'build_architecture': build_platform.architecture,
            'machine_os_name': machine_platform.os_name,
            'machine_platform': machine_platform.platform,
            'machine_architecture': machine_platform.architecture,
            'job_group_name': job_group.name,
            'job_group_symbol': job_group.symbol,
            'job_type_name': job_type.name,
            'job_type_symbol': job_type.symbol,
            'option_collection_hash': option_collection_hash,
        },
    )

    tier = job_datum.get('tier') or 1

    result = job_datum.get('result', 'unknown')

    submit_time = datetime.fromtimestamp(_get_number(job_datum.get('submit_timestamp')))
    start_time = datetime.fromtimestamp(_get_number(job_datum.get('start_timestamp')))
    end_time = datetime.fromtimestamp(_get_number(job_datum.get('end_timestamp')))

    # first, try to create the job with the given guid (if it doesn't
    # exist yet)
    job_guid_root = get_guid_root(job_guid)
    if not Job.objects.filter(guid__in=[job_guid, job_guid_root]).exists():
        # This could theoretically already have been created by another process
        # that is running updates simultaneously.  So just attempt to create
        # it, but allow it to skip if it's the same guid.  The odds are
        # extremely high that this is a pending and running job that came in
        # quick succession and are being processed by two different workers.
        Job.objects.get_or_create(
            guid=job_guid,
            defaults={
                "repository": repository,
                "signature": signature,
                "build_platform": build_platform,
                "machine_platform": machine_platform,
                "machine": machine,
                "option_collection_hash": option_collection_hash,
                "job_type": job_type,
                "job_group": job_group,
                "product": product,
                "failure_classification": default_failure_classification,
                "who": who,
                "reason": reason,
                "result": result,
                "state": state,
                "tier": tier,
                "submit_time": submit_time,
                "start_time": start_time,
                "end_time": end_time,
                "last_modified": datetime.now(),
                "push_id": push_id,
            },
        )
    # Can't just use the ``job`` we would get from the ``get_or_create``
    # because we need to try the job_guid_root instance first for update,
    # rather than a possible retry job instance.
    try:
        job = Job.objects.get(guid=job_guid_root)
    except ObjectDoesNotExist:
        job = Job.objects.get(guid=job_guid)

    # add taskcluster metadata if applicable
    if all([k in job_datum for k in ['taskcluster_task_id', 'taskcluster_retry_id']]):
        try:
            TaskclusterMetadata.objects.create(
                job=job,
                task_id=job_datum['taskcluster_task_id'],
                retry_id=job_datum['taskcluster_retry_id'],
            )
        except IntegrityError:
            pass

    # Update job with any data that would have changed
    Job.objects.filter(id=job.id).update(
        guid=job_guid,
        signature=signature,
        build_platform=build_platform,
        machine_platform=machine_platform,
        machine=machine,
        option_collection_hash=option_collection_hash,
        job_type=job_type,
        job_group=job_group,
        product=product,
        result=result,
        state=state,
        tier=tier,
        submit_time=submit_time,
        start_time=start_time,
        end_time=end_time,
        last_modified=datetime.now(),
        push_id=push_id,
    )

    artifacts = job_datum.get('artifacts', [])

    has_text_log_summary = any(x for x in artifacts if x['name'] == 'text_log_summary')
    if artifacts:
        artifacts = serialize_artifact_json_blobs(artifacts)

        # need to add job guid to artifacts, since they likely weren't
        # present in the beginning
        for artifact in artifacts:
            if not all(k in artifact for k in ("name", "type", "blob")):
                raise ValueError("Artifact missing properties: {}".format(artifact))
            # Ensure every artifact has a ``job_guid`` value.
            # It is legal to submit an artifact that doesn't have a
            # ``job_guid`` value.  But, if missing, it should inherit that
            # value from the job itself.
            if "job_guid" not in artifact:
                artifact["job_guid"] = job_guid

        store_job_artifacts(artifacts)

    log_refs = job_datum.get('log_references', [])
    job_logs = []
    if log_refs:
        for log in log_refs:
            name = log.get('name') or 'unknown'
            name = name[0:50]

            url = log.get('url') or 'unknown'
            url = url[0:255]

            # this indicates that a summary artifact was submitted with
            # this job that corresponds to the buildbot_text log url.
            # Therefore, the log does not need parsing.  So we should
            # ensure that it's marked as already parsed.
            if has_text_log_summary and name == 'buildbot_text':
                parse_status = JobLog.PARSED
            else:
                parse_status_map = dict([(k, v) for (v, k) in JobLog.STATUSES])
                mapped_status = parse_status_map.get(log.get('parse_status'))
                if mapped_status:
                    parse_status = mapped_status
                else:
                    parse_status = JobLog.PENDING

            jl, _ = JobLog.objects.get_or_create(
                job=job, name=name, url=url, defaults={'status': parse_status}
            )

            job_logs.append(jl)

        _schedule_log_parsing(job, job_logs, result)

    return job_guid


def _schedule_log_parsing(job, job_logs, result):
    """Kick off the initial task that parses the log data.

    log_data is a list of job log objects and the result for that job
    """

    # importing here to avoid an import loop
    from treeherder.log_parser.tasks import parse_logs

    task_types = {"errorsummary_json", "buildbot_text", "builds-4h"}

    job_log_ids = []
    for job_log in job_logs:
        # a log can be submitted already parsed.  So only schedule
        # a parsing task if it's ``pending``
        # the submitter is then responsible for submitting the
        # text_log_summary artifact
        if job_log.status != JobLog.PENDING:
            continue

        # if this is not a known type of log, abort parse
        if job_log.name not in task_types:
            continue

        job_log_ids.append(job_log.id)

    # TODO: Replace the use of different queues for failures vs not with the
    # RabbitMQ priority feature (since the idea behind separate queues was
    # only to ensure failures are dealt with first if there is a backlog).
    if result != 'success':
        queue = 'log_parser_fail'
        priority = 'failures'
    else:
        queue = 'log_parser'
        priority = "normal"

    parse_logs.apply_async(queue=queue, args=[job.id, job_log_ids, priority])


def store_job_data(repository, originalData):
    """
    Store job data instances into jobs db

    Example:
    [
        {
            "revision": "24fd64b8251fac5cf60b54a915bffa7e51f636b5",
            "job": {
                "job_guid": "d19375ce775f0dc166de01daa5d2e8a73a8e8ebf",
                "name": "xpcshell",
                "desc": "foo",
                "job_symbol": "XP",
                "group_name": "Shelliness",
                "group_symbol": "XPC",
                "product_name": "firefox",
                "state": "TODO",
                "result": 0,
                "reason": "scheduler",
                "who": "sendchange-unittest",
                "submit_timestamp": 1365732271,
                "start_timestamp": "20130411165317",
                "end_timestamp": "1365733932"
                "machine": "tst-linux64-ec2-314",
                "build_platform": {
                    "platform": "Ubuntu VM 12.04",
                    "os_name": "linux",
                    "architecture": "x86_64"
                },
                "machine_platform": {
                    "platform": "Ubuntu VM 12.04",
                    "os_name": "linux",
                    "architecture": "x86_64"
                },
                "option_collection": {
                    "opt": true
                },
                "log_references": [
                    {
                        "url": "http://ftp.mozilla.org/pub/...",
                        "name": "unittest"
                    }
                ],
                artifacts:[{
                    type:" json | img | ...",
                    name:"",
                    log_urls:[
                        ]
                    blob:""
                }],
            },
            "superseded": []
        },
        ...
    ]

    """
    data = copy.deepcopy(originalData)
    # Ensure that we have job data to process
    if not data:
        return

    # remove any existing jobs that already have the same state
    data = _remove_existing_jobs(data)
    if not data:
        return

    superseded_job_guid_placeholders = []

    # TODO: Refactor this now that store_job_data() is only over called with one job at a time.
    for datum in data:
        try:
            # TODO: this might be a good place to check the datum against
            # a JSON schema to ensure all the fields are valid.  Then
            # the exception we caught would be much more informative.  That
            # being said, if/when we transition to only using the pulse
            # job consumer, then the data will always be vetted with a
            # JSON schema before we get to this point.
            job = datum['job']
            revision = datum['revision']
            superseded = datum.get('superseded', [])

            revision_field = 'revision__startswith' if len(revision) < 40 else 'revision'
            filter_kwargs = {'repository': repository, revision_field: revision}
            push_id = Push.objects.values_list('id', flat=True).get(**filter_kwargs)

            # load job
            job_guid = _load_job(repository, job, push_id)

            for superseded_guid in superseded:
                superseded_job_guid_placeholders.append(
                    # superseded by guid, superseded guid
                    [job_guid, superseded_guid]
                )
        except Exception as e:
            # Surface the error immediately unless running in production, where we'd
            # rather report it on New Relic and not block storing the remaining jobs.
            # TODO: Once buildbot support is removed, remove this as part of
            # refactoring this method to process just one job at a time.
            if 'DYNO' not in os.environ:
                raise

            logger.exception(e)
            # make more fields visible in new relic for the job
            # where we encountered the error
            datum.update(datum.get("job", {}))
            newrelic.agent.record_exception(params=datum)

            # skip any jobs that hit errors in these stages.
            continue

    # Update the result/state of any jobs that were superseded by those ingested above.
    if superseded_job_guid_placeholders:
        for (job_guid, superseded_by_guid) in superseded_job_guid_placeholders:
            Job.objects.filter(guid=superseded_by_guid).update(
                result='superseded', state='completed'
            )
