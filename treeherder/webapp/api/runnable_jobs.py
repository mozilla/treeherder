from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_500_INTERNAL_SERVER_ERROR

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
        decision_task_id = request.query_params.get('decision_task_id')
        if decision_task_id:
            tc_graph_url = settings.TASKCLUSTER_TASKGRAPH_URL.format(task_id=decision_task_id)
            tc_graph = None
            validate = URLValidator()
            try:
                validate(tc_graph_url)
                tc_graph = fetch_json(tc_graph_url)
            except ValidationError:
                # We pass here as we still want to schedule BuildBot jobs
                pass
            except Exception as ex:
                return Response("Exception: {0}".format(ex), status=HTTP_500_INTERNAL_SERVER_ERROR)
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
            task_metadata = node['task']['metadata']
            treeherder_options = node['task']['extra']['treeherder']
            build_platform = treeherder_options.get('machine', {}).get('platform', '')

            # Not all tasks have a group name
            job_group_name = treeherder_options.get('groupName', '')

            # Not all tasks have a group symbol
            job_group_symbol = treeherder_options.get('groupSymbol', '')

            # Not all tasks have a collection
            if 'collection' in treeherder_options:
                platform_option = ' '.join(treeherder_options['collection'].keys())
            else:
                platform_option = ""

            ret.append({
                'build_platform': build_platform,
                'platform': build_platform,
                'job_group_name': job_group_name,
                'job_group_symbol': job_group_symbol,
                'job_type_name': task_metadata['name'],
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
