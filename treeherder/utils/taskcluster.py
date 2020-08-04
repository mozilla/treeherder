import taskcluster_urls

from treeherder.utils.http import fetch_json


def get_task_definition(root_url, task_id):
    task_url = taskcluster_urls.api(root_url, 'queue', 'v1', 'task/{}'.format(task_id))
    return fetch_json(task_url)
