import gzip
from io import BytesIO
import json

import taskcluster_urls
from cache_memoize import cache_memoize

from treeherder.model.models import Repository

from treeherder.utils.http import fetch_json, make_request


@cache_memoize(60 * 60)
def get_gecko_decision_artifact(project, revision, file_path):
    repo = Repository.objects.get(name=project)
    url = f'{repo.tc_root_url}/api/index/v1/task/gecko.v2.{project}.revision.{revision}.taskgraph.decision/artifacts/public/{file_path}'
    response = make_request(url)

    if response.headers['Content-Type'] == 'application/gzip':
        buffer = BytesIO(response.content)
        deflatedContent = gzip.GzipFile(fileobj=buffer)
        return json.loads(deflatedContent.read())

    return response.content


def get_task_definition(root_url, task_id):
    task_url = taskcluster_urls.api(root_url, 'queue', 'v1', 'task/{}'.format(task_id))
    return fetch_json(task_url)
