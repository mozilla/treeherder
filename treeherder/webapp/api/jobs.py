import datetime
import logging

import django_filters
from dateutil import parser
from django.core.exceptions import ObjectDoesNotExist
from django.db import models as django_models
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.status import HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND

from treeherder.model.error_summary import get_error_summary
from treeherder.model.models import (
    Job,
    JobDetail,
    JobLog,
    OptionCollection,
    Repository,
    TextLogError,
    TextLogStep,
)
from treeherder.webapp.api import pagination, serializers
from treeherder.webapp.api.utils import CharInFilter, NumberInFilter, to_timestamp

logger = logging.getLogger(__name__)


class JobFilter(django_filters.FilterSet):
    """
    We use this gigantic class to provide the same filtering interface
    as the previous jobs API
    """

    id = django_filters.NumberFilter(field_name='id')
    id__in = NumberInFilter(field_name='id', lookup_expr='in')
    tier__in = NumberInFilter(field_name='tier', lookup_expr='in')
    push_id__in = NumberInFilter(field_name='push_id', lookup_expr='in')
    job_guid = django_filters.CharFilter(field_name='guid')
    job_guid__in = CharInFilter(field_name='guid', lookup_expr='in')
    build_architecture = django_filters.CharFilter(field_name='build_platform__architecture')
    build_os = django_filters.CharFilter(field_name='build_platform__os_name')
    build_platform = django_filters.CharFilter(field_name='build_platform__platform')
    build_system_type = django_filters.CharFilter(field_name='signature__build_system_type')
    job_group_id = django_filters.NumberFilter(field_name='job_group_id')
    job_group_name = django_filters.CharFilter(field_name='job_group__name')
    job_group_symbol = django_filters.CharFilter(field_name='job_group__symbol')
    job_type_name = django_filters.CharFilter(field_name='job_type__name')
    job_type_symbol = django_filters.CharFilter(field_name='job_type__symbol')
    machine_name = django_filters.CharFilter(field_name='machine__name')
    machine_platform_architecture = django_filters.CharFilter(
        field_name='machine_platform__architecture'
    )
    machine_platform_os = django_filters.CharFilter(field_name='machine_platform__os_name')
    platform = django_filters.CharFilter(field_name='machine_platform__platform')
    ref_data_name = django_filters.CharFilter(field_name='signature__name')
    signature = django_filters.CharFilter(field_name='signature__signature')
    task_id = django_filters.CharFilter(field_name='taskcluster_metadata__task_id')
    retry_id = django_filters.NumberFilter(field_name='taskcluster_metadata__retry_id')

    class Meta:
        model = Job
        fields = {
            'option_collection_hash': ['exact'],
            'build_platform_id': ['exact'],
            'failure_classification_id': ['exact'],
            'job_type_id': ['exact'],
            'job_group_id': ['exact'],
            'reason': ['exact'],
            'state': ['exact'],
            'result': ['exact'],
            'who': ['exact'],
            'tier': ['lt', 'lte', 'exact', 'gt', 'gte'],
            'id': ['lt', 'lte', 'exact', 'gt', 'gte'],
            'push_id': ['lt', 'lte', 'exact', 'gt', 'gte'],
            'last_modified': ['lt', 'lte', 'exact', 'gt', 'gte'],
            'submit_time': ['lt', 'lte', 'exact', 'gt', 'gte'],
            'start_time': ['lt', 'lte', 'exact', 'gt', 'gte'],
            'end_time': ['lt', 'lte', 'exact', 'gt', 'gte'],
        }
        filter_overrides = {
            django_models.DateTimeField: {'filter_class': django_filters.IsoDateTimeFilter}
        }


class JobsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    This viewset is the jobs endpoint.
    """

    _default_select_related = [
        'job_type',
        'job_group',
        'machine_platform',
        'signature',
        'taskcluster_metadata',
        'push',
    ]
    _query_field_names = [
        'submit_time',
        'start_time',
        'end_time',
        'failure_classification_id',
        'id',
        'job_group__name',
        'job_group__symbol',
        'job_type__name',
        'job_type__symbol',
        'last_modified',
        'option_collection_hash',
        'machine_platform__platform',
        'option_collection_hash',
        'push_id',
        'push__revision',
        'result',
        'signature__signature',
        'state',
        'tier',
        'taskcluster_metadata__task_id',
        'taskcluster_metadata__retry_id',
    ]
    _output_field_names = [
        'failure_classification_id',
        'id',
        'job_group_name',
        'job_group_symbol',
        'job_type_name',
        'job_type_symbol',
        'last_modified',
        'platform',
        'push_id',
        'push_revision',
        'result',
        'signature',
        'state',
        'tier',
        'task_id',
        'retry_id',
        'duration',
        'platform_option',
    ]
    queryset = (
        Job.objects.all()
        .order_by('id')
        .select_related(*_default_select_related)
        .values(*_query_field_names)
    )
    serializer_class = serializers.JobSerializer
    filterset_class = JobFilter
    pagination_class = pagination.JobPagination

    def get_serializer_context(self):
        option_collection_map = OptionCollection.objects.get_option_collection_map()
        return {'option_collection_map': option_collection_map}

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        resp.data['job_property_names'] = self._output_field_names
        return Response(resp.data)


class JobsProjectViewSet(viewsets.ViewSet):
    """
    This viewset is the project bound version of the jobs endpoint.
    """

    # data that we want to do select_related on when returning job objects
    # (so we don't have a zillion db queries)
    _default_select_related = [
        'build_platform',
        'job_type',
        'job_group',
        'machine_platform',
        'machine',
        'signature',
        'repository',
        'taskcluster_metadata',
    ]

    _property_query_mapping = [
        ('build_architecture', 'build_platform__architecture', None),
        ('build_os', 'build_platform__os_name', None),
        ('build_platform', 'build_platform__platform', None),
        ('build_platform_id', 'build_platform_id', None),
        ('build_system_type', 'signature__build_system_type', None),
        ('end_timestamp', 'end_time', to_timestamp),
        ('failure_classification_id', 'failure_classification_id', None),
        ('id', 'id', None),
        ('job_group_description', 'job_group__description', None),
        ('job_group_id', 'job_group_id', None),
        ('job_group_name', 'job_group__name', None),
        ('job_group_symbol', 'job_group__symbol', None),
        ('job_guid', 'guid', None),
        ('job_type_description', 'job_type__description', None),
        ('job_type_id', 'job_type_id', None),
        ('job_type_name', 'job_type__name', None),
        ('job_type_symbol', 'job_type__symbol', None),
        ('last_modified', 'last_modified', None),
        ('machine_name', 'machine__name', None),
        ('machine_platform_architecture', 'machine_platform__architecture', None),
        ('machine_platform_os', 'machine_platform__os_name', None),
        ('option_collection_hash', 'option_collection_hash', None),
        ('platform', 'machine_platform__platform', None),
        ('push_id', 'push_id', None),
        ('reason', 'reason', None),
        ('ref_data_name', 'signature__name', None),
        ('result', 'result', None),
        ('result_set_id', 'push_id', None),
        ('signature', 'signature__signature', None),
        ('start_timestamp', 'start_time', to_timestamp),
        ('state', 'state', None),
        ('submit_timestamp', 'submit_time', to_timestamp),
        ('tier', 'tier', None),
        ('who', 'who', None),
        ('task_id', 'taskcluster_metadata__task_id', None),
        ('retry_id', 'taskcluster_metadata__retry_id', None),
    ]

    _option_collection_hash_idx = [pq[0] for pq in _property_query_mapping].index(
        'option_collection_hash'
    )

    def _get_job_list_response(self, job_qs, offset, count, return_type):
        '''
        custom method to serialize + format jobs information

        It's worth doing this big ugly thing (as opposed to using
        the django rest framework serializer or whatever) as
        this function is often in the critical path
        '''
        option_collection_map = OptionCollection.objects.get_option_collection_map()
        results = []
        for values in job_qs[offset : (offset + count)].values_list(
            *[pq[1] for pq in self._property_query_mapping]
        ):
            platform_option = option_collection_map.get(
                values[self._option_collection_hash_idx], ""
            )
            # some values need to be transformed
            values = list(values)
            for (i, _) in enumerate(values):
                func = self._property_query_mapping[i][2]
                if func:
                    values[i] = func(values[i])
            # append results differently depending on if we are returning
            # a dictionary or a list
            if return_type == 'dict':
                results.append(
                    dict(
                        zip(
                            [pq[0] for pq in self._property_query_mapping] + ['platform_option'],
                            values + [platform_option],
                        )
                    )
                )
            else:
                results.append(values + [platform_option])

        response_dict = {'results': results}
        if return_type == 'list':
            response_dict.update(
                {
                    'job_property_names': [pq[0] for pq in self._property_query_mapping]
                    + ['platform_option']
                }
            )

        return response_dict

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for detail view

        Return a single job with log_references and
        artifact names and links to the artifact blobs.
        """
        try:
            job = Job.objects.select_related(*self._default_select_related).get(
                repository__name=project, id=pk
            )
        except Job.DoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        resp = serializers.JobProjectSerializer(job, read_only=True).data

        resp["resource_uri"] = reverse("jobs-detail", kwargs={"project": project, "pk": pk})
        resp["logs"] = []
        for (name, url) in JobLog.objects.filter(job=job).values_list('name', 'url'):
            resp["logs"].append({'name': name, 'url': url})

        platform_option = job.get_platform_option()
        if platform_option:
            resp["platform_option"] = platform_option

        try:
            resp['task_id'] = job.taskcluster_metadata.task_id
            resp['retry_id'] = job.taskcluster_metadata.retry_id
            # Keep for backwards compatability
            resp['taskcluster_metadata'] = {
                'task_id': job.taskcluster_metadata.task_id,
                'retry_id': job.taskcluster_metadata.retry_id,
            }
        except ObjectDoesNotExist:
            pass

        status_map = {k: v for k, v in Job.AUTOCLASSIFY_STATUSES}
        resp["autoclassify_status"] = status_map[job.autoclassify_status]

        return Response(resp)

    def list(self, request, project):
        """
        GET method implementation for list view
        Optional parameters (default):
        - offset (0)
        - count (10)
        - return_type (dict)
        """
        MAX_JOBS_COUNT = 2000

        # make a mutable copy of these params
        filter_params = request.query_params.copy()

        # various hacks to ensure API backwards compatibility
        for param_key in filter_params.keys():
            # replace `result_set_id` with `push_id`
            if param_key.startswith('result_set_id'):
                new_param_key = param_key.replace('result_set_id', 'push_id')
                filter_params[new_param_key] = filter_params[param_key]
                del filter_params[param_key]
            # convert legacy timestamp parameters to time ones
            elif param_key in ['submit_timestamp', 'start_timestamp', 'end_timestamp']:
                new_param_key = param_key.replace('timestamp', 'time')
                filter_params[new_param_key] = datetime.datetime.fromtimestamp(
                    float(filter_params[param_key])
                )
                del filter_params[param_key]
            # sanity check 'last modified'
            elif param_key.startswith('last_modified'):
                datestr = filter_params[param_key]
                try:
                    parser.parse(datestr)
                except ValueError:
                    return Response(
                        "Invalid date value for `last_modified`: {}".format(datestr),
                        status=HTTP_400_BAD_REQUEST,
                    )

        try:
            offset = int(filter_params.get("offset", 0))
            count = int(filter_params.get("count", 10))
        except ValueError:
            return Response("Invalid value for offset or count", status=HTTP_400_BAD_REQUEST)
        return_type = filter_params.get("return_type", "dict").lower()

        if count > MAX_JOBS_COUNT:
            msg = "Specified count exceeds API MAX_JOBS_COUNT value: {}".format(MAX_JOBS_COUNT)
            return Response({"detail": msg}, status=HTTP_400_BAD_REQUEST)

        try:
            repository = Repository.objects.get(name=project)
        except Repository.DoesNotExist:
            return Response(
                {"detail": "No project with name {}".format(project)}, status=HTTP_404_NOT_FOUND
            )
        jobs = JobFilter(
            {k: v for (k, v) in filter_params.items()},
            queryset=Job.objects.filter(repository=repository).select_related(
                *self._default_select_related
            ),
        ).qs

        response_body = self._get_job_list_response(jobs, offset, count, return_type)
        response_body["meta"] = dict(repository=project, offset=offset, count=count)

        return Response(response_body)

    @action(detail=True, methods=['get'])
    def text_log_steps(self, request, project, pk=None):
        """
        Gets a list of steps associated with this job
        """
        try:
            job = Job.objects.get(repository__name=project, id=pk)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        textlog_steps = (
            TextLogStep.objects.filter(job=job)
            .order_by('started_line_number')
            .prefetch_related('errors')
        )
        return Response(
            serializers.TextLogStepSerializer(textlog_steps, many=True, read_only=True).data
        )

    @action(detail=True, methods=['get'])
    def text_log_errors(self, request, project, pk=None):
        """
        Gets a list of steps associated with this job
        """
        try:
            job = Job.objects.get(repository__name=project, id=pk)
        except Job.DoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)
        textlog_errors = (
            TextLogError.objects.filter(step__job=job)
            .select_related("_metadata", "_metadata__failure_line")
            .prefetch_related("classified_failures", "matches")
            .order_by('id')
        )
        return Response(
            serializers.TextLogErrorSerializer(textlog_errors, many=True, read_only=True).data
        )

    @action(detail=True, methods=['get'])
    def bug_suggestions(self, request, project, pk=None):
        """
        Gets a set of bug suggestions for this job
        """
        try:
            job = Job.objects.get(repository__name=project, id=pk)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        return Response(get_error_summary(job))

    @action(detail=True, methods=['get'])
    def similar_jobs(self, request, project, pk=None):
        """
        Get a list of jobs similar to the one selected.
        """
        try:
            repository = Repository.objects.get(name=project)
        except Repository.DoesNotExist:
            return Response(
                {"detail": "No project with name {}".format(project)}, status=HTTP_404_NOT_FOUND
            )

        try:
            job = Job.objects.get(repository=repository, id=pk)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        filter_params = request.query_params.copy()

        try:
            offset = int(filter_params.get("offset", 0))
            # we don't need a big page size on this endoint,
            # let's cap it to 50 elements
            count = int(filter_params.get("count", 50))
        except ValueError:
            return Response("Invalid value for offset or count", status=HTTP_400_BAD_REQUEST)

        return_type = filter_params.get("return_type", "dict").lower()

        jobs = JobFilter(
            {k: v for (k, v) in filter_params.items()},
            queryset=Job.objects.filter(job_type_id=job.job_type_id, repository=repository)
            .exclude(id=job.id)
            .select_related(*self._default_select_related),
        ).qs

        # similar jobs we want in descending order from most recent
        jobs = jobs.order_by('-push_id', '-start_time')

        response_body = self._get_job_list_response(jobs, offset, count, return_type)
        response_body["meta"] = dict(offset=offset, count=count, repository=project)

        return Response(response_body)


class JobDetailViewSet(viewsets.ReadOnlyModelViewSet):
    '''
    Endpoint for retrieving metadata (e.g. links to artifacts, file sizes)
    associated with a particular job
    '''

    queryset = JobDetail.objects.all().select_related('job', 'job__repository')
    serializer_class = serializers.JobDetailSerializer

    class JobDetailFilter(django_filters.rest_framework.FilterSet):

        job_id = django_filters.NumberFilter(field_name='job')
        job_id__in = NumberInFilter(field_name='job', lookup_expr='in')
        job_guid = django_filters.CharFilter(field_name='job__guid')
        job__guid = django_filters.CharFilter(field_name='job__guid')  # for backwards compat
        title = django_filters.CharFilter(field_name='title')
        value = django_filters.CharFilter(field_name='value')
        push_id = django_filters.NumberFilter(field_name='job__push')
        repository = django_filters.CharFilter(field_name='job__repository__name')

        class Meta:
            model = JobDetail
            fields = [
                'job_id',
                'job_guid',
                'job__guid',
                'job_id__in',
                'title',
                'value',
                'push_id',
                'repository',
            ]

    filter_backends = [django_filters.rest_framework.DjangoFilterBackend]
    filterset_class = JobDetailFilter

    # using a custom pagination size of 2000 to avoid breaking mozscreenshots
    # which doesn't paginate through results yet
    # https://github.com/mnoorenberghe/mozscreenshots/issues/28
    class JobDetailPagination(pagination.IdPagination):
        page_size = 2000

    pagination_class = JobDetailPagination

    # one of these is required
    required_filters = ['job_guid', 'job__guid', 'job_id', 'job_id__in', 'push_id']

    def list(self, request):
        query_param_keys = request.query_params.keys()

        # unfiltered requests can potentially create huge sql queries, so
        # make sure the user passes a job id or guid
        if set(self.required_filters).isdisjoint(set(query_param_keys)):
            raise ParseError("Must filter on one of: {}".format(", ".join(self.required_filters)))

        return viewsets.ReadOnlyModelViewSet.list(self, request)
