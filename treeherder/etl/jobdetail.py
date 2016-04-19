import json

from treeherder.jobs.models import JobDetail


def load_job_details(job_guid, artifact):
    job_details = json.loads(artifact['blob'])['job_details']
    for job_detail in job_details:
        JobDetail.objects.get_or_create(
            job_guid=job_guid,
            title=job_detail.get('title'),
            value=job_detail['value'],
            url=job_detail.get('url'))
