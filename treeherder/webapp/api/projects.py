import simplejson as json
from django.http import HttpResponse, HttpResponseNotFound

from treeherder.model.derived import DatasetNotFoundError, JobsModel


def project_info(request, project):
    try:
        with JobsModel(project) as jobs_model:
            return HttpResponse(
                content=json.dumps(
                    {'max_job_id': jobs_model.get_max_job_id()}
                ),
                content_type='application/json'
            )
    except DatasetNotFoundError:
        return HttpResponseNotFound('Project does not exist')
