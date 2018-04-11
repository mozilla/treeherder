import datetime

import django_filters
from dateutil import parser
from django.core.exceptions import ObjectDoesNotExist
from django.db import models as django_models
from rest_framework import viewsets
from rest_framework.decorators import (detail_route,
                                       list_route)
from rest_framework.exceptions import ParseError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.status import (HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)
from six import iteritems

from treeherder.etl.jobs import store_job_data
from treeherder.model.error_summary import get_error_summary
from treeherder.model.models import (FailureLine,
                                     Job,
                                     JobDetail,
                                     JobLog,
                                     OptionCollection,
                                     Repository,
                                     TextLogError,
                                     TextLogStep)
from treeherder.model.tasks import publish_job_action
from treeherder.webapp.api import (pagination,
                                   permissions,
                                   serializers)
from treeherder.webapp.api.utils import (CharInFilter,
                                         NumberInFilter,
                                         to_timestamp)


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
    build_architecture = django_filters.CharFilter(
        field_name='build_platform__architecture')
    build_os = django_filters.CharFilter(
        field_name='build_platform__os_name')
    build_platform = django_filters.CharFilter(
        field_name='build_platform__platform')
    build_system_type = django_filters.CharFilter(
        field_name='signature__build_system_type')
    job_group_id = django_filters.NumberFilter(
        field_name='job_group_id')
    job_group_name = django_filters.CharFilter(
        field_name='job_group__name')
    job_group_symbol = django_filters.CharFilter(
        field_name='job_group__symbol')
    job_type_name = django_filters.CharFilter(
        field_name='job_type__name')
    job_type_symbol = django_filters.CharFilter(
        field_name='job_type__symbol')
    machine_name = django_filters.CharFilter(
        field_name='machine__name')
    machine_platform_architecture = django_filters.CharFilter(
        field_name='machine_platform__architecture')
    machine_platform_os = django_filters.CharFilter(
        field_name='machine_platform__os_name')
    platform = django_filters.CharFilter(
        field_name='machine_platform__platform')
    ref_data_name = django_filters.CharFilter(
        field_name='signature__name')
    signature = django_filters.CharFilter(
        field_name='signature__signature')

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
            'end_time': ['lt', 'lte', 'exact', 'gt', 'gte']
        }
        filter_overrides = {
            django_models.DateTimeField: {
                'filter_class': django_filters.IsoDateTimeFilter
            }
        }


class JobsViewSet(viewsets.ViewSet):

    """
    This viewset is responsible for the jobs endpoint.

    """
    throttle_scope = 'jobs'
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

    # data that we want to do select_related on when returning job objects
    # (so we don't have a zillion db queries)
    _default_select_related = [
        'build_platform',
        'job_type',
        'job_group',
        'machine_platform',
        'machine',
        'signature',
        'repository'
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
    ]

    _option_collection_hash_idx = [pq[0] for pq in _property_query_mapping].index(
        'option_collection_hash')

    def _get_job_list_response(self, job_qs, offset, count, return_type):
        '''
        custom method to serialize + format jobs information

        It's worth doing this big ugly thing (as opposed to using
        the django rest framework serializer or whatever) as
        this function is often in the critical path
        '''
        option_collection_map = OptionCollection.objects.get_option_collection_map()
        results = []
        for values in job_qs[offset:(offset+count)].values_list(
                *[pq[1] for pq in self._property_query_mapping]):
            platform_option = option_collection_map.get(
                values[self._option_collection_hash_idx],
                "")
            # some values need to be transformed
            values = list(values)
            for (i, _) in enumerate(values):
                func = self._property_query_mapping[i][2]
                if func:
                    values[i] = func(values[i])
            # append results differently depending on if we are returning
            # a dictionary or a list
            if return_type == 'dict':
                results.append(dict(zip(
                    [pq[0] for pq in self._property_query_mapping] +
                    ['platform_option'],
                    values + [platform_option])))
            else:
                results.append(values + [platform_option])

        response_dict = {
            'results': results
        }
        if return_type == 'list':
            response_dict.update({
                'job_property_names': [pq[0] for pq in self._property_query_mapping] + ['platform_option']
            })

        return response_dict

    def _job_action_event(self, job, action, requester_email):
        """
        Helper for issuing an 'action' for a given job (such as
        cancel/retrigger)

        :param job int: The job which this action pertains to.
        :param action str: Name of the action (cancel, etc..).
        :param requester str: Email address of the user who caused action.
        """
        publish_job_action.apply_async(
            args=[job.repository.name, action, job.id, requester_email],
            routing_key='publish_to_pulse'
        )

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for detail view

        Return a single job with log_references and
        artifact names and links to the artifact blobs.
        """
        try:
            job = Job.objects.select_related(
                *self._default_select_related + ['taskcluster_metadata']).get(
                    repository__name=project, id=pk)
        except Job.DoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        resp = serializers.JobSerializer(job, read_only=True).data

        resp["resource_uri"] = reverse("jobs-detail",
                                       kwargs={"project": project, "pk": pk})
        resp["logs"] = []
        for (name, url) in JobLog.objects.filter(job=job).values_list(
                'name', 'url'):
            resp["logs"].append({'name': name, 'url': url})

        platform_option = job.get_platform_option()
        if platform_option:
            resp["platform_option"] = platform_option

        try:
            resp['taskcluster_metadata'] = {
                'task_id': job.taskcluster_metadata.task_id,
                'retry_id': job.taskcluster_metadata.retry_id
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
            elif param_key in ['submit_timestamp', 'start_timestamp',
                               'end_timestamp']:
                new_param_key = param_key.replace('timestamp', 'time')
                filter_params[new_param_key] = datetime.datetime.fromtimestamp(
                    float(filter_params[param_key]))
                del filter_params[param_key]
            # sanity check 'last modified'
            elif param_key.startswith('last_modified'):
                datestr = filter_params[param_key]
                try:
                    parser.parse(datestr)
                except ValueError:
                    return Response(
                        "Invalid date value for `last_modified`: {}".format(datestr),
                        status=HTTP_400_BAD_REQUEST)

        try:
            offset = int(filter_params.get("offset", 0))
            count = int(filter_params.get("count", 10))
        except ValueError:
            return Response(
                "Invalid value for offset or count",
                status=HTTP_400_BAD_REQUEST)
        return_type = filter_params.get("return_type", "dict").lower()

        if count > MAX_JOBS_COUNT:
            msg = "Specified count exceeds API MAX_JOBS_COUNT value: {}".format(MAX_JOBS_COUNT)
            return Response({"detail": msg}, status=HTTP_400_BAD_REQUEST)

        try:
            repository = Repository.objects.get(name=project)
        except Repository.DoesNotExist:
            return Response({
                "detail": "No project with name {}".format(project)
            }, status=HTTP_404_NOT_FOUND)
        jobs = JobFilter({k: v for (k, v) in iteritems(filter_params)},
                         queryset=Job.objects.filter(
                             repository=repository).select_related(
                                 *self._default_select_related)).qs

        response_body = self._get_job_list_response(jobs, offset, count,
                                                    return_type)
        response_body["meta"] = dict(repository=project, offset=offset,
                                     count=count)

        return Response(response_body)

    @list_route(methods=['post'], permission_classes=[IsAuthenticated])
    def cancel(self, request, project):
        try:
            job_ids = [int(job_id) for job_id in request.data["job_id_list"]]
        except ValueError:
            return Response(
                {"message": "Job id(s) must be specified as integers"},
                status=HTTP_400_BAD_REQUEST)

        for job_id in job_ids:
            try:
                job = Job.objects.get(repository__name=project,
                                      id=job_id)
            except ObjectDoesNotExist:
                return Response("No job with id: {0}".format(job_id),
                                status=HTTP_404_NOT_FOUND)

            self._job_action_event(job, 'cancel', request.user.email)

            # Mark pending jobs as cancelled to work around buildbot not including
            # cancelled jobs in builds-4hr if they never started running.
            # TODO: Remove when we stop using buildbot.
            if job.state == 'pending':
                job.state = 'completed'
                job.result = 'usercancel'
                job.save()

        return Response({"message": "canceled jobs '{0}'".format(job_ids)})

    @list_route(methods=['post'], permission_classes=[IsAuthenticated])
    def retrigger(self, request, project):
        """
        Issue a "retrigger" to the underlying build_system_type by scheduling a
        pulse message.
        """
        job_id_list = request.data["job_id_list"]
        failure = []
        for pk in job_id_list:
            try:
                job = Job.objects.get(repository__name=project,
                                      id=pk)
                self._job_action_event(job, 'retrigger', request.user.email)
            except ObjectDoesNotExist:
                failure.append(pk)

        if failure:
            return Response("Jobs with id(s): '{0}' were not retriggered.".format(failure),
                            status=HTTP_404_NOT_FOUND)
        return Response({"message": "All jobs successfully retriggered."})

    @detail_route(methods=['get'])
    def failure_lines(self, request, project, pk=None):
        """
        Get a list of test failure lines for the job
        """
        try:
            job = Job.objects.get(repository__name=project,
                                  id=pk)
            queryset = FailureLine.objects.filter(
                job_guid=job.guid).prefetch_related(
                    "matches", "matches__matcher"
                )
            failure_lines = [serializers.FailureLineNoStackSerializer(obj).data
                             for obj in queryset]
            return Response(failure_lines)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['get'])
    def text_log_steps(self, request, project, pk=None):
        """
        Gets a list of steps associated with this job
        """
        try:
            job = Job.objects.get(repository__name=project,
                                  id=pk)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        textlog_steps = TextLogStep.objects.filter(job=job).order_by(
            'started_line_number').prefetch_related('errors')
        return Response(serializers.TextLogStepSerializer(textlog_steps,
                                                          many=True,
                                                          read_only=True).data)

    @detail_route(methods=['get'])
    def text_log_errors(self, request, project, pk=None):
        """
        Gets a list of steps associated with this job
        """
        try:
            job = Job.objects.get(repository__name=project,
                                  id=pk)
        except Job.DoesNotExist:
            return Response("No job with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)
        textlog_errors = (TextLogError.objects
                          .filter(step__job=job)
                          .select_related("_metadata",
                                          "_metadata__failure_line")
                          .prefetch_related("classified_failures",
                                            "matches",
                                            "matches__matcher")
                          .order_by('id'))
        return Response(serializers.TextLogErrorSerializer(textlog_errors,
                                                           many=True,
                                                           read_only=True).data)

    @detail_route(methods=['get'])
    def bug_suggestions(self, request, project, pk=None):
        """
        Gets a set of bug suggestions for this job
        """
        try:
            job = Job.objects.get(repository__name=project, id=pk)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        return Response(get_error_summary(job))

    @detail_route(methods=['get'])
    def similar_jobs(self, request, project, pk=None):
        """
        Get a list of jobs similar to the one selected.
        """
        try:
            repository = Repository.objects.get(name=project)
        except Repository.DoesNotExist:
            return Response({
                "detail": "No project with name {}".format(project)
            }, status=HTTP_404_NOT_FOUND)

        try:
            job = Job.objects.get(repository=repository, id=pk)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)

        filter_params = request.query_params.copy()

        try:
            offset = int(filter_params.get("offset", 0))
            # we don't need a big page size on this endoint,
            # let's cap it to 50 elements
            count = int(filter_params.get("count", 50))
        except ValueError:
            return Response("Invalid value for offset or count",
                            status=HTTP_400_BAD_REQUEST)

        return_type = filter_params.get("return_type", "dict").lower()

        jobs = JobFilter({k: v for (k, v) in iteritems(filter_params)},
                         queryset=Job.objects.filter(
                             job_type_id=job.job_type_id,
                             repository=repository).exclude(
                                 id=job.id).select_related(
                                     *self._default_select_related)).qs

        # similar jobs we want in descending order from most recent
        jobs = jobs.order_by('-start_time')

        response_body = self._get_job_list_response(jobs, offset, count,
                                                    return_type)
        response_body["meta"] = dict(offset=offset, count=count,
                                     repository=project)

        return Response(response_body)

    def create(self, request, project):
        """
        This method adds a job to a given push.
        """
        try:
            repository = Repository.objects.get(name=project)
        except ObjectDoesNotExist:
            return Response("No repository with name: {0}".format(project),
                            status=HTTP_404_NOT_FOUND)

        store_job_data(repository, request.data)

        return Response({'message': 'Job successfully updated'})


class JobDetailViewSet(viewsets.ReadOnlyModelViewSet):
    '''
    Endpoint for retrieving metadata (e.g. links to artifacts, file sizes)
    associated with a particular job
    '''
    queryset = JobDetail.objects.all().select_related('job', 'job__repository')
    serializer_class = serializers.JobDetailSerializer

    class JobDetailFilter(django_filters.rest_framework.FilterSet):

        class NumberInFilter(django_filters.filters.BaseInFilter,
                             django_filters.NumberFilter):

            # prevent a non-filter if ``value`` is empty
            # See https://github.com/carltongibson/django-filter/issues/755
            def filter(self, qs, value):
                if value in django_filters.constants.EMPTY_VALUES:
                    raise ParseError("Invalid filter on empty value: {}".format(value))

                return django_filters.Filter.filter(self, qs, value)

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
            fields = ['job_id', 'job_guid', 'job__guid', 'job_id__in', 'title',
                      'value', 'push_id', 'repository']

    filter_backends = [django_filters.rest_framework.DjangoFilterBackend]
    filter_class = JobDetailFilter

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
            raise ParseError("Must filter on one of: {}".format(
                ", ".join(self.required_filters)))

        return viewsets.ReadOnlyModelViewSet.list(self, request)
