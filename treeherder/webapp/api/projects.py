# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.http import HttpResponse, HttpResponseNotFound
from treeherder.model.derived import DatasetNotFoundError
import simplejson as json

from treeherder.model.derived import JobsModel


def project_info(request, project):
    try:
        jm = JobsModel(project)
        return HttpResponse(content=json.dumps({'max_job_id': jm.get_max_job_id(),
                                                'max_performance_artifact_id':
                                                jm.get_max_performance_artifact_id()}
                                               ),
                            content_type='application/json'
                            )
    except DatasetNotFoundError:
        return HttpResponseNotFound('Project does not exist')
