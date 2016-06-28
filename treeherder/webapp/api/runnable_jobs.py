from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.etl.common import fetch_json
from treeherder.model import models


class RunnableJobsViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the runnable_jobs endpoint.

    """

    def list(self, request, project):
        """
        GET method implementation for list of all runnable buildbot jobs
        """
        if 'decisionTaskID' in request.query_params and len(request.query_params['decisionTaskID']):
            decisionTaskID = request.query_params['decisionTaskID']
            tc_jobs_url = "https://queue.taskcluster.net/v1/task/" + decisionTaskID + "/artifacts/public/full-task-graph.json"
            tc_graph = None
            validate = URLValidator()
            try:
                validate(tc_jobs_url)
                tc_graph = fetch_json(tc_jobs_url)
            except ValidationError:
                pass
            except Exception as ex:
                return Response("Exception: {0}".format(ex), 500)
        else:
            tc_graph = {}

        repository = models.Repository.objects.get(name=project)

        options_by_hash = models.OptionCollection.objects.all().select_related(
            'option').values_list('option__name', 'option_collection_hash')

        runnable_jobs = models.RunnableJob.objects.filter(
            repository=repository
        ).select_related('build_platform', 'machine_platform',
                         'job_type', 'job_type__job_group')

        ret = []

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
                'job_coalesced_to_guid': None,
                'state': 'runnable',
                'result': 'runnable'})

        for label, node in tc_graph.iteritems():
            build_platform = node['task']['extra']['treeherder']['build']['platform']
            job_type_name = node['task']['metadata']['name']
            task_metadata = node['task']['metadata']
            treeherder_options = node['task']['extra']['treeherder']

            # Not all tasks have a group name
            job_group_name = treeherder_options.get('groupName', '')

            # Not all tasks have a group symbol
            job_group_symbol = treeherder_options.get('groupSymbol', '')

            # Not all tasks have a collection
            if 'collection' in treeherder_options:
                platform_option = treeherder_options['collection'].keys()[0]
            else:
                platform_option = ""

            ret.append({
                'build_platform': build_platform,
                'platform': build_platform,
                'job_group_name': job_group_name,
                'job_group_symbol': job_group_symbol,
                'job_type_name': job_type_name,
                'job_type_symbol': treeherder_options['symbol'],
                'job_type_description': task_metadata['description'],
                'ref_data_name': label,
                'build_system_type': 'taskcluster',
                'platform_option': platform_option,
                'job_coalesced_to_guid': None,
                'state': 'runnable',
                'result': 'runnable'})
        response_body = dict(meta={"repository": project,
                                   "offset": 0,
                                   "count": len(ret)},
                             results=ret)

        return Response(response_body)
