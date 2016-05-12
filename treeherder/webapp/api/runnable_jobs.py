import datetime
import json

import requests
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.model import models


class RunnableJobsViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the runnable_jobs endpoint.

    """

    def list(self, request, project):
        """
        GET method implementation for list of all runnable buildbot jobs
        """
        tc_jobs_url = request.query_params['tcURL']
        tc_graph = None
        validate = URLValidator()
        try:
            validate(tc_jobs_url)
            resp = requests.get(url=tc_jobs_url)
            tc_graph = json.loads(resp.text)
        except ValidationError:
            pass
        except Exception as ex:
            return Response("Exception: {0}".format(ex), 500)

        # so I got the graph in tc_graph successfully. How do I parse it in
        # the given format?

        repository = models.Repository.objects.get(name=project)

        options_by_hash = models.OptionCollection.objects.all().select_related(
            'option').values_list('option__name', 'option_collection_hash')

        runnable_jobs = models.RunnableJob.objects.filter(
            repository=repository,
            last_touched__gte=datetime.datetime.now() - datetime.timedelta(weeks=1)
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

        for node in tc_graph['tasks']:
            build_platform = node['task']['extra']['treeherder']['build']['platform']
            try:
                build_platform_data = models.BuildPlatform.objects.get(platform=build_platform)
                build_platform_id = build_platform_data.id
                build_os = build_platform_data.os_name
                build_architecture = build_platform_data.architecture
            except models.BuildPlatform.DoesNotExist:
                build_platform_id = ""
                build_os = ""
                build_architecture = ""

            machine_platform = node['task']['extra']['treeherder']['machine']['platform']
            try:
                machine_platform_data = models.MachinePlatform.objects.get(platform=machine_platform)
                machine_platform_id = machine_platform_data.id
                machine_platform_os = machine_platform_data.os_name
                machine_platform_architecture = machine_platform_data.architecture
            except models.MachinePlatform.DoesNotExist:
                machine_platform_id = ""
                machine_platform_os = ""
                machine_platform_architecture = ""

            job_type_name = node['task']['metadata']['name']
            try:
                job_type_data = models.JobType.objects.get(name=job_type_name)
                job_type_id = job_type_data.id
            except models.JobType.DoesNotExist:
                job_type_id = ""

            if 'groupName' in node['task']['extra']['treeherder']:
                job_group_name = node['task']['extra']['treeherder']['groupName']
            else:
                job_group_name = ""
            try:
                job_group_data = models.JobGroup.objects.get(name=job_group_name)
                job_group_id = job_group_data.id
            except models.JobGroup.DoesNotExist:
                job_group_id = None

            ret.append({
                'build_platform_id': build_platform_id,
                'build_platform': build_platform,
                'build_os': build_os,
                'build_architecture': build_architecture,
                'machine_platform_id': machine_platform_id,
                'platform': build_platform,
                'machine_platform_os': machine_platform_os,
                'machine_platform_architecture': machine_platform_architecture,
                'job_group_id': job_group_id,
                'job_group_name': job_group_name,
                'job_group_symbol': node['task']['extra']['treeherder']['groupSymbol'],
                'job_group_description': "",
                'job_type_id': job_type_id,
                'job_type_name': job_type_name,
                'job_type_symbol': node['task']['extra']['treeherder']['symbol'],
                'job_type_description': node['task']['metadata']['description'],
                'option_collection_hash': node['task']['extra']['treeherder']['revision_hash'],
                'ref_data_name': node['task']['extra']['treeherder']['revision'],
                'build_system_type': 'taskcluster',
                'platform_option': node['task']['extra']['treeherder']['collection'].keys()[0],
                'job_coalesced_to_guid': None,
                'state': 'runnable',
                'result': 'runnable'})
        response_body = dict(meta={"repository": project,
                                   "offset": 0,
                                   "count": len(ret)},
                             results=ret)

        return Response(response_body)
