import taskcluster_urls
import yaml

from treeherder.utils.http import fetch_json, fetch_text, make_request


def get_task_definition(root_url, task_id):
    task_url = taskcluster_urls.api(root_url, 'queue', 'v1', 'task/{}'.format(task_id))
    return fetch_json(task_url)


def get_artifact(root_url, task_id, path):
    artifact_url = taskcluster_urls.api(
        root_url, 'queue', 'v1', 'task/{}/artifacts/{}'.format(task_id, path)
    )

    if path.endswith(".json"):
        return fetch_json(artifact_url)
    if path.endswith(".yml"):
        return yaml.load_stream(fetch_text(artifact_url))

    return make_request(artifact_url)
