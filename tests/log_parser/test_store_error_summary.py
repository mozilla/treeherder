import responses
from django.core.management import call_command

from treeherder.model.models import FailureLine, Repository, RepositoryGroup
from ..sampledata import SampleData


def test_store_error_summary(activate_responses, jm, eleven_jobs_stored, initial_data):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = 'http://my-log.mozilla.org'

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url,
                      body=log_handler.read(), status=200)

    job = jm.get_job(1)[0]
    repository_group = RepositoryGroup.objects.create(name="repo_group")
    repository = Repository.objects.create(name=jm.project,
                                           repository_group=repository_group)

    call_command('store_error_summary', log_url, job['job_guid'], jm.project)

    assert FailureLine.objects.count() == 1

    failure = FailureLine.objects.get(pk=1)

    assert failure.job_guid == job['job_guid']

    assert failure.repository == repository
