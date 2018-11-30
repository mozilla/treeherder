import logging

import requests
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from six import iteritems

from treeherder.etl.common import fetch_json

logger = logging.getLogger(__name__)

RUNNABLE_JOBS_URL = 'https://queue.taskcluster.net/v1/task/{task_id}/runs/0/artifacts/public/runnable-jobs.json'
TASKCLUSTER_INDEX_URL = 'https://index.taskcluster.net/v1/task/gecko.v2.%s.latest.taskgraph.decision'


def _taskcluster_runnable_jobs(project, decision_task_id):
    ret = []
    tc_graph = {}
    if not decision_task_id:
        decision_task_id = query_latest_gecko_decision_task_id(project)
    # Some trees (e.g. comm-central) don't have a decision task, which means there are no taskcluster runnable jobs
    if not decision_task_id:
        return ret

    tc_graph_url = RUNNABLE_JOBS_URL.format(task_id=decision_task_id)
    validate = URLValidator()
    try:
        validate(tc_graph_url)
        tc_graph = fetch_json(tc_graph_url)
    except ValidationError:
        logger.warning('Failed to validate %s', tc_graph_url)
        return []
    except requests.exceptions.HTTPError as e:
        logger.info('HTTPError %s when getting uncompressed taskgraph at %s',
                    e.response.status_code, tc_graph_url)
        logger.info('Attempting to fall back to the compressed taskgraph...')
        tc_graph = _taskcluster_runnable_jobs_gz(tc_graph_url + ".gz")

    for label, node in iteritems(tc_graph):
        ret.append({
            'build_platform': node.get('platform', ''),
            'build_system_type': 'taskcluster',
            'job_group_name': node.get('groupName', ''),
            'job_group_symbol': node.get('groupSymbol', ''),
            'job_type_name': label,
            'job_type_symbol': node['symbol'],
            'platform': node.get('platform'),
            'platform_option': ' '.join(node.get('collection', {}).keys()),
            'ref_data_name': label,
            'state': 'runnable',
            'result': 'runnable',
        })

    return ret


def _taskcluster_runnable_jobs_gz(tc_graph_url):
    try:
        # `force_gzip_encoding` works around Taskcluster not setting `Content-Encoding: gzip`:
        # https://bugzilla.mozilla.org/show_bug.cgi?id=1423215
        tc_graph = fetch_json(tc_graph_url, force_gzip_decompression=True)
    except ValidationError:
        logger.warning('Failed to validate %s', tc_graph_url)
        return []
    except requests.exceptions.HTTPError as e:
        logger.info('HTTPError %s when getting taskgraph at %s',
                    e.response.status_code, tc_graph_url)
        return []
    return tc_graph


def list_runnable_jobs(project, decision_task_id=None):
    results = _taskcluster_runnable_jobs(project, decision_task_id)

    return dict(meta={"repository": project, "offset": 0, "count": len(results)}, results=results)


def query_latest_gecko_decision_task_id(project):
    url = TASKCLUSTER_INDEX_URL % project
    logger.info('Fetching %s', url)
    try:
        latest_task = fetch_json(url)
        task_id = latest_task['taskId']
        logger.info('For %s we found the task id: %s', project, task_id)
    except requests.exceptions.HTTPError as e:
        # Specifically handle 404 errors, as it means there's no decision task on this push
        if e.response.status_code == 404:
            logger.info('For %s we did not find a task id', project)
            task_id = None
        else:
            raise
    return task_id
