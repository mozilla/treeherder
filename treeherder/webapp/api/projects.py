from django.http import HttpResponse, HttpResponseNotFound
from treeherder.model.derived import DatasetNotFoundError
import json

from treeherder.model.derived import JobsModel

def project_info(request, project):
    try:
        jm = JobsModel(project)
        return HttpResponse(json.dumps({'max_job_id': jm.get_max_job_id()}),
                            mimetype='application/json')
    except DatasetNotFoundError:
        return HttpResponseNotFound('Project does not exist')
