import logging

import requests
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

from treeherder.utils.github import fetch_json

logger = logging.getLogger(__name__)

RUNNABLE_JOBS_URL = 'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/{task_id}/runs/{run_number}/artifacts/public/runnable-jobs.json'
TASKCLUSTER_INDEX_URL = 'https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2.%s.latest.taskgraph.decision'


def _taskcluster_runnable_jobs(project):
    decision_task_id = query_latest_gecko_decision_task_id(project)
    # Some trees (e.g. comm-central) don't have a decision task, which means there are no taskcluster runnable jobs
    if not decision_task_id:
        return []

    for run_number in range(0, 5):
        tc_graph_url = RUNNABLE_JOBS_URL.format(task_id=decision_task_id, run_number=run_number)
        validate = URLValidator()
        try:
            validate(tc_graph_url)
        except ValidationError:
            logger.warning('Failed to validate %s', tc_graph_url)
            return []

        try:
            tc_graph = fetch_json(tc_graph_url)
        except requests.exceptions.HTTPError as e:
            logger.info('HTTPError %s when getting taskgraph at %s',
                        e.response.status_code, tc_graph_url)
            continue

        return [
            {
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
            }
            for label, node in tc_graph.items()
        ]

    return []


def list_runnable_jobs(project):
    return _taskcluster_runnable_jobs(project)


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
