import collections
import datetime
import logging
from hashlib import sha1

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

from treeherder.config.settings import TASKCLUSTER_INDEX_URL
from treeherder.etl.buildbot import get_symbols_and_platforms
from treeherder.etl.common import fetch_json
from treeherder.model.models import (BuildPlatform,
                                     JobGroup,
                                     JobType,
                                     MachinePlatform,
                                     Option,
                                     OptionCollection,
                                     Repository,
                                     RunnableJob)

logger = logging.getLogger(__name__)


class AllthethingsTransformerMixin:

    def transform(self, extracted_content):
        logger.info('About to import allthethings.json builder data.')

        jobs_per_branch = collections.defaultdict(list)

        for builder, content in extracted_content['builders'].iteritems():
            job = get_symbols_and_platforms(builder)

            branch = content['properties']['branch']
            job.update({'branch': branch})
            jobs_per_branch[branch].append(job)

        return jobs_per_branch


class RunnableJobsProcess(AllthethingsTransformerMixin):

    # XXX: Copied from refdata.py. What is the best place for this?
    def get_option_collection_hash(self, options):
        """returns an option_collection_hash given a list of options"""

        options = sorted(list(options))
        sha_hash = sha1()
        # equivalent to loop over the options and call sha_hash.update()
        sha_hash.update(''.join(options))
        return sha_hash.hexdigest()

    def update_runnable_jobs_table(self, jobs_per_branch):
        active_repositories = Repository.objects.all().filter(
            active_status='active')

        now = datetime.datetime.now()
        for repo in active_repositories:
            # Some active repositories might not have any buildbot
            # builders.
            if repo.name not in jobs_per_branch:
                continue

            for datum in jobs_per_branch[repo.name]:
                # XXX: refdata.py truncates those fields at 25 characters.
                # Should we do the same?
                build_platform, _ = BuildPlatform.objects.get_or_create(
                    os_name=datum['build_os'],
                    platform=datum['build_platform'],
                    architecture=datum['build_architecture']
                )

                machine_platform, _ = MachinePlatform.objects.get_or_create(
                    os_name=datum['machine_platform_os'],
                    platform=datum['platform'],
                    architecture=datum['machine_platform_architecture']
                )

                job_group, _ = JobGroup.objects.get_or_create(
                    name=datum['job_group_name'],
                    symbol=datum['job_group_symbol']
                )

                job_type, _ = JobType.objects.get_or_create(
                    name=datum['job_type_name'],
                    symbol=datum['job_type_symbol'],
                    defaults={'job_group': job_group}
                )

                option_collection_hash = self.get_option_collection_hash(
                    datum['option_collection'].keys())

                for key in datum['option_collection'].keys():
                    option, _ = Option.objects.get_or_create(name=key)
                    OptionCollection.objects.get_or_create(
                        option_collection_hash=option_collection_hash,
                        option=option)

                # This automatically updates the last_touched field.
                RunnableJob.objects.update_or_create(
                    ref_data_name=datum['ref_data_name'],
                    build_system_type=datum['build_system_type'],
                    defaults={'build_platform': build_platform,
                              'machine_platform': machine_platform,
                              'job_type': job_type,
                              'option_collection_hash': option_collection_hash,
                              'repository': repo})

        # prune any buildernames that were not just touched/created
        RunnableJob.objects.filter(last_touched__lt=now).delete()

    def run(self):
        logger.info('Fetching allthethings.json')
        all_the_things = fetch_json(settings.ALLTHETHINGS_URL)
        jobs_per_branch = self.transform(all_the_things)
        logger.info('Updating runnable jobs table with transformed allthethings.json data.')
        self.update_runnable_jobs_table(jobs_per_branch)


def _taskcluster_runnable_jobs(project, decision_task_id):
    ret = []
    tc_graph = {}
    if not decision_task_id:
        decision_task_id = _query_latest_gecko_decision_task_id(project)
    # If we still don't have task id, lets just bail out now
    if not decision_task_id:
        return ret

    tc_graph_url = settings.TASKCLUSTER_TASKGRAPH_URL.format(task_id=decision_task_id)
    validate = URLValidator()
    try:
        validate(tc_graph_url)
        tc_graph = fetch_json(tc_graph_url)
    except ValidationError:
        logger.warning('Failed to validate {}'.format(tc_graph_url))
        return []

    for label, node in tc_graph.iteritems():
        if not ('extra' in node['task'] and 'treeherder' in node['task']['extra']):
            # some tasks don't have the treeherder information we need
            # to be able to display them (and are not intended to be
            # displayed). skip.
            continue

        treeherder_options = node['task']['extra']['treeherder']
        task_metadata = node['task']['metadata']
        platform_option = ' '.join(treeherder_options.get('collection', {}).keys())

        ret.append({
            'build_platform': treeherder_options.get('machine', {}).get('platform', ''),
            'build_system_type': 'taskcluster',
            'job_group_name': treeherder_options.get('groupName', ''),
            'job_group_symbol': treeherder_options.get('groupSymbol', ''),
            'job_type_description': task_metadata['description'],
            'job_type_name': task_metadata['name'],
            'job_type_symbol': treeherder_options['symbol'],
            'platform': treeherder_options.get('machine', {}).get('platform', ''),
            'platform_option': platform_option,
            'ref_data_name': label,
            'state': 'runnable',
            'result': 'runnable',
            'job_coalesced_to_guid': None
            })

    return ret


def _buildbot_runnable_jobs(project):
    ret = []
    repository = Repository.objects.get(name=project)
    options_by_hash = OptionCollection.objects.all().select_related(
        'option').values_list('option__name', 'option_collection_hash')

    runnable_jobs = RunnableJob.objects.filter(
        repository=repository
    ).select_related('build_platform', 'machine_platform',
                     'job_type', 'job_type__job_group')

    # Adding buildbot jobs
    for datum in runnable_jobs:
        options = ' '.join(option_name for (option_name, col_hash) in options_by_hash
                           if col_hash == datum.option_collection_hash)

        ret.append({
            'build_platform_id': datum.build_platform.id,
            'build_platform': datum.build_platform.platform,
            'build_os': datum.build_platform.os_name,
            'build_architecture': datum.build_platform.architecture,
            'machine_platform_id': datum.machine_platform.id,
            'platform': datum.machine_platform.platform,
            'machine_platform_os': datum.machine_platform.os_name,
            'machine_platform_architecture': datum.machine_platform.architecture,
            'job_group_id': datum.job_type.job_group.id,
            'job_group_name': datum.job_type.job_group.name,
            'job_group_symbol': datum.job_type.job_group.symbol,
            'job_group_description': datum.job_type.job_group.description,
            'job_type_id': datum.job_type.id,
            'job_type_name': datum.job_type.name,
            'job_type_symbol': datum.job_type.symbol,
            'job_type_description': datum.job_type.description,
            'option_collection_hash': datum.option_collection_hash,
            'ref_data_name': datum.ref_data_name,
            'build_system_type': datum.build_system_type,
            'platform_option': options,
            'result': 'runnable',
            'state': 'runnable',
            'job_coalesced_to_guid': None
            })

    return ret


def list_runnable_jobs(project, decision_task_id=None):
    ret = _buildbot_runnable_jobs(project)
    ret = ret + _taskcluster_runnable_jobs(project, decision_task_id)

    return dict(meta={"repository": project, "offset": 0, "count": len(ret)}, results=ret)


def _query_latest_gecko_decision_task_id(project):
    url = TASKCLUSTER_INDEX_URL % project
    logger.info('Fetching {}'.format(url))
    latest_task = fetch_json(url)
    task_id = latest_task['taskId']
    logger.info('For {} we found the task id: {}'.format(project, task_id))
    return task_id
