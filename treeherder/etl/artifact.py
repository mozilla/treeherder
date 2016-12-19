import logging

import dateutil.parser
import simplejson as json
from django.db import transaction
from django.db.utils import IntegrityError

from treeherder.etl.perf import store_performance_artifact
from treeherder.etl.text import astral_filter
from treeherder.model import error_summary
from treeherder.model.models import (Job,
                                     JobDetail,
                                     TextLogError,
                                     TextLogStep)

logger = logging.getLogger(__name__)


def store_job_info_artifact(job, job_info_artifact):
    """
    Store the contents of the job info artifact
    in job details
    """
    job_details = json.loads(job_info_artifact['blob'])['job_details']
    for job_detail in job_details:
        job_detail_dict = {
            'title': job_detail.get('title'),
            'value': job_detail['value'],
            'url': job_detail.get('url')
        }
        for (k, v) in job_detail_dict.items():
            max_field_length = JobDetail._meta.get_field(k).max_length
            if v is not None and len(v) > max_field_length:
                logger.warning("Job detail '{}' for job_guid {} too long, "
                               "truncating".format(
                                   v[:max_field_length],
                                   job.guid))
                job_detail_dict[k] = v[:max_field_length]

        # move the url field to be updated in defaults now that it's
        # had its size trimmed, if necessary
        job_detail_dict['defaults'] = {'url': job_detail_dict['url']}
        del job_detail_dict['url']

        JobDetail.objects.update_or_create(
            job=job,
            **job_detail_dict)


def store_text_log_summary_artifact(job, text_log_summary_artifact):
    """
    Store the contents of the text log summary artifact
    """
    step_data = json.loads(
        text_log_summary_artifact['blob'])['step_data']
    result_map = {v: k for (k, v) in TextLogStep.RESULTS}
    with transaction.atomic():
        for step in step_data['steps']:
            name = step['name'][:TextLogStep._meta.get_field('name').max_length]
            # process start/end times if we have them
            # we currently don't support timezones in treeherder, so
            # just ignore that when importing/updating the bug to avoid
            # a ValueError (though by default the text log summaries
            # we produce should have time expressed in UTC anyway)
            time_kwargs = {}
            for tkey in ('started', 'finished'):
                if step.get(tkey):
                    time_kwargs[tkey] = dateutil.parser.parse(
                        step[tkey], ignoretz=True)

            log_step = TextLogStep.objects.create(
                job=job,
                started_line_number=step['started_linenumber'],
                finished_line_number=step['finished_linenumber'],
                name=name,
                result=result_map[step['result']],
                **time_kwargs)

            if step.get('errors'):
                for error in step['errors']:
                    TextLogError.objects.create(
                        step=log_step,
                        line_number=error['linenumber'],
                        line=astral_filter(error['line']))

    # get error summary immediately (to warm the cache)
    error_summary.get_error_summary(job)


def store_job_artifacts(artifact_data):
    """
    Store a list of job artifacts. All of the datums in artifact_data need
    to be in the following format:

        {
            'type': 'json',
            'name': 'my-artifact-name',
            # blob can be any kind of structured data
            'blob': { 'stuff': [1, 2, 3, 4, 5] },
            'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
        }

    """
    for index, artifact in enumerate(artifact_data):
        # Determine what type of artifact we have received
        if artifact:
            artifact_name = artifact.get('name')
            if not artifact_name:
                logger.error("load_job_artifacts: Unnamed job artifact, "
                             "skipping")
                continue
            job_guid = artifact.get('job_guid')
            if not job_guid:
                logger.error("load_job_artifacts: Artifact '{}' with no "
                             "job guid set, skipping".format(
                                 artifact_name))
                continue

            try:
                job = Job.objects.get(guid=job_guid)
            except Job.DoesNotExist:
                logger.error(
                    ('load_job_artifacts: No job_id for '
                     'guid {}'.format(job_guid)))
                continue

            if artifact_name == 'performance_data':
                store_performance_artifact(job, artifact)
            elif artifact_name == 'Job Info':
                store_job_info_artifact(job, artifact)
            elif artifact_name == 'text_log_summary':
                try:
                    store_text_log_summary_artifact(job, artifact)
                except IntegrityError:
                    logger.warning("Couldn't insert text log information "
                                   "for job with guid %s, this probably "
                                   "means the job was already parsed",
                                   job_guid)
            elif artifact_name == 'buildapi':
                buildbot_request_id = json.loads(artifact['blob']).get(
                    'request_id')
                if buildbot_request_id:
                    JobDetail.objects.update_or_create(
                        job=job,
                        title='buildbot_request_id',
                        value=str(buildbot_request_id))
            else:
                logger.warning("Unknown artifact type: %s submitted with job %s",
                               artifact_name, job.guid)
        else:
            logger.error(
                ('store_job_artifacts: artifact type '
                 '{} not understood'.format(artifact_name)))


def serialize_artifact_json_blobs(artifacts):
    """
    Ensure that JSON artifact blobs passed as dicts are converted to JSON
    """
    for artifact in artifacts:
        blob = artifact['blob']
        if (artifact['type'].lower() == 'json' and
            not isinstance(blob, str) and
            not isinstance(blob, unicode)):
            artifact['blob'] = json.dumps(blob)

    return artifacts
