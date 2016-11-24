import datetime

import django_filters
from dateutil import parser
from django.core.exceptions import ObjectDoesNotExist
from django.db import models as django_models
from rest_framework import (filters,
                            viewsets)
from rest_framework.decorators import (detail_route,
                                       list_route)
from rest_framework.exceptions import ParseError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.status import (HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)

from treeherder.model.error_summary import get_error_summary
from treeherder.model.models import (ExclusionProfile,
                                     FailureLine,
                                     Job,
                                     JobDetail,
                                     JobLog,
                                     OptionCollection,
                                     Repository,
                                     TextLogError,
                                     TextLogStep,
                                     TextLogSummary)
from treeherder.webapp.api import (pagination,
                                   permissions,
                                   serializers)
from treeherder.webapp.api.utils import (CharInFilter,
                                         NumberInFilter,
                                         with_jobs)


class JobFilter(django_filters.FilterSet):
    """
    We use this gigantic class to provide the same filtering interface
    as the previous jobs API
    """
    id = django_filters.NumberFilter(name='project_specific_id')
    id__in = NumberInFilter(name='project_specific_id', lookup_expr='in')
    tier__in = NumberInFilter(name='tier', lookup_expr='in')
    push_id__in = NumberInFilter(name='push_id', lookup_expr='in')
    job_guid = django_filters.CharFilter(name='guid')
    job_guid__in = CharInFilter(name='guid', lookup_expr='in')
    job_coalesced_to_guid = django_filters.CharFilter(name='coalesced_to_guid')
    build_architecture = django_filters.CharFilter(
        name='build_platform__architecture')
    build_os = django_filters.CharFilter(
        name='build_platform__os_name')
    build_platform = django_filters.CharFilter(
        name='build_platform__platform')
    build_system_type = django_filters.CharFilter(
        name='signature__build_system_type')
    job_group_id = django_filters.NumberFilter(
        name='job_type__job_group_id')
    job_group_name = django_filters.CharFilter(
        name='job_type__job_group__name')
    job_group_symbol = django_filters.CharFilter(
        name='job_type__job_group__symbol')
    job_type_name = django_filters.CharFilter(
        name='job_type__name')
    job_type_symbol = django_filters.CharFilter(
        name='job_type__symbol')
    machine_name = django_filters.CharFilter(
        name='machine__name')
    machine_platform_architecture = django_filters.CharFilter(
        name='machine_platform__architecture')
    machine_platform_os = django_filters.CharFilter(
        name='machine_platform__os_name')
    platform = django_filters.CharFilter(
        name='machine_platform__platform')
    ref_data_name = django_filters.CharFilter(
        name='signature__name')
    signature = django_filters.CharFilter(
        name='signature__signature')

    class Meta:
        model = Job
        fields = {
            'option_collection_hash': ['exact'],
            'build_platform_id': ['exact'],
            'failure_classification_id': ['exact'],
            'job_type_id': ['exact'],
            'reason': ['exact'],
            'state': ['exact'],
            'result': ['exact'],
            'who': ['exact'],
            'tier': ['lt', 'lte', 'exact', 'gt', 'gte'],
            'build_platform_id': ['exact'],
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
        'job_type__job_group',
        'machine_platform',
        'machine',
        'signature',
        'repository'
    ]

    @staticmethod
    def _get_option_collection_map():
        option_collection_map = {}
        for (hash, option_name) in OptionCollection.objects.values_list(
                'option_collection_hash', 'option__name'):
            if not option_collection_map.get(hash):
                option_collection_map[hash] = option_name
            else:
                option_collection_map[hash] += (' ' + option_name)

        return option_collection_map

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for detail view

        Return a single job with log_references and
        artifact names and links to the artifact blobs.
        """
        try:
            job = Job.objects.select_related(
                *self._default_select_related).get(
                    repository__name=project, id=pk)
        except Job.DoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        resp = serializers.JobSerializer(job).data

        resp["resource_uri"] = reverse("jobs-detail",
                                       kwargs={"project": project, "pk": pk})
        resp["logs"] = []
        for (name, url) in JobLog.objects.filter(job=job).values_list(
                'name', 'url'):
            resp["logs"].append({'name': name, 'url': url})

        option_hash = job.option_collection_hash
        if option_hash:
            option_collection_map = self._get_option_collection_map()
            resp["platform_option"] = option_collection_map[option_hash]

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

        offset = int(filter_params.get("offset", 0))
        count = int(filter_params.get("value", 10))
        return_type = filter_params.get("return_type", "dict").lower()
        exclusion_profile = filter_params.get("exclusion_profile", "default")
        visibility = filter_params.get("visibility", "included")
        if exclusion_profile in ('false', 'null'):
            exclusion_profile = None

        if count > MAX_JOBS_COUNT:
            msg = "Specified count exceeds API MAX_JOBS_COUNT value: {}".format(MAX_JOBS_COUNT)
            return Response({"error": msg}, status=HTTP_400_BAD_REQUEST)

        try:
            repository = Repository.objects.get(name=project)
        except Repository.DoesNotExist:
            return Response({
                "detail": "No project with name {}".format(project)
            }, status=HTTP_404_NOT_FOUND)

        jobs = JobFilter({k: v for (k, v) in filter_params.iteritems()},
                         queryset=Job.objects.filter(
                             repository=repository).select_related(
                                 *self._default_select_related)).qs

        if exclusion_profile:
            try:
                signatures = ExclusionProfile.objects.get_signatures_for_project(
                    project, exclusion_profile)
                if signatures:
                    # NOT here means "not part of the exclusion profile"
                    if visibility == "included":
                        jobs = jobs.exclude(
                            signature__signature__in=signatures)
                    else:
                        jobs = jobs.filter(
                            signature__signature__in=signatures)
                else:
                    # this repo/project has no hidden signatures
                    # if ``visibility`` is set to ``included`` then it's
                    # meaningless to add any of these limiting params to the
                    # query, just run it and give the user everything for the
                    # project.
                    #
                    # If ``visibility`` is ``excluded`` then we only want to
                    # include jobs that were excluded by this profile.  Since
                    # no jobs are excluded for this project, we should return
                    # an empty array and skip the query altogether.
                    if visibility == "excluded":
                        jobs = []
            except ExclusionProfile.DoesNotExist:
                # Either there's no default profile setup or the profile
                # specified is not available
                pass

        results = serializers.JobSerializer(jobs[offset:count], many=True).data
        if results:
            option_collection_map = self._get_option_collection_map()
            for job in results:
                option_hash = job['option_collection_hash']
                if option_hash:
                    job["platform_option"] = option_collection_map[option_hash]

        response_body = dict(meta={"repository": project}, results=[])
        if results and return_type == "list":
            response_body["job_property_names"] = results[0].keys()
            results = [job.values() for job in results]
        response_body["results"] = results
        response_body["meta"].update(offset=offset, count=count)

        return Response(response_body)

    @detail_route(methods=['post'])
    @with_jobs
    def update_state(self, request, project, jm, pk=None):
        """
        Change the state of a job.
        """
        state = request.data.get('state', None)

        # check that this state is valid
        if state not in jm.STATES:
            return Response(
                {"message": ("'{0}' is not a valid state.  Must be "
                             "one of: {1}".format(
                                 state,
                                 ", ".join(jm.STATES)
                             ))},
                status=HTTP_400_BAD_REQUEST,
            )

        if not pk:  # pragma nocover
            return Response({"message": "job id required"}, status=HTTP_400_BAD_REQUEST)

        obj = jm.get_job(pk)
        if obj:
            jm.set_state(pk, state)
            return Response({"message": "state updated to '{0}'".format(state)})
        return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def cancel(self, request, project, jm, pk=None):
        """
        Change the state of a job.
        """
        job = jm.get_job(pk)
        if job:
            jm.cancel_job(request.user.email, job[0])
            return Response({"message": "canceled job '{0}'".format(job[0]['job_guid'])})
        return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

    @list_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def retrigger(self, request, project, jm):
        """
        Issue a "retrigger" to the underlying build_system_type by scheduling a
        pulse message.
        """
        job_id_list = request.data["job_id_list"]
        failure = []
        for pk in job_id_list:
            job = jm.get_job(pk)
            if job:
                jm.retrigger(request.user.email, job[0])
            else:
                failure.append(pk)

        if failure:
            return Response("Jobs with id(s): '{0}' were not retriggered.".format(failure),
                            status=HTTP_404_NOT_FOUND)
        return Response({"message": "All jobs successfully retriggered."})

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def backfill(self, request, project, jm, pk=None):
        """
        Issue a "backfill" to the underlying build_system_type by scheduling a
        pulse message.
        """
        job = jm.get_job(pk)
        if job:
            jm.backfill(request.user.email, job[0])
            return Response({"message": "backfilled job '{0}'".format(job[0]['job_guid'])})
        return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['get'])
    @with_jobs
    def failure_lines(self, request, project, jm, pk=None):
        """
        Get a list of test failure lines for the job
        """
        job = jm.get_job(pk)
        if job:
            queryset = FailureLine.objects.filter(
                job_guid=job[0]['job_guid']
            ).prefetch_related(
                "matches", "matches__matcher"
            )
            failure_lines = [serializers.FailureLineNoStackSerializer(obj).data
                             for obj in queryset]
            return Response(failure_lines)
        return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['get'])
    def text_log_summary(self, request, project, pk=None):
        """
        Get a list of test failure lines for the job
        """
        try:
            job = Job.objects.get(repository__name=project,
                                  project_specific_id=pk)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        summary = TextLogSummary.objects.filter(
            job_guid=job.guid
        ).prefetch_related("lines").all()

        if len(summary) > 1:
            raise ValueError("Got multiple TextLogSummaries for the same job")

        if not summary:
            return Response("No text_log_summary generated for job with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)

        summary = summary[0]

        lines_by_number = {error.line_number: error.line for error in
                           TextLogError.objects.filter(step__job=job)}

        rv = serializers.TextLogSummarySerializer(summary).data
        rv["bug_suggestions"] = get_error_summary(job)

        for line in rv["lines"]:
            line["line"] = lines_by_number[line["line_number"]]

        return Response(rv)

    @detail_route(methods=['get'])
    @with_jobs
    def text_log_steps(self, request, project, jm, pk=None):
        """
        Gets a list of steps associated with this job
        """
        job = jm.get_job(pk)
        if not job:
            return Response("No job with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)
        textlog_steps = TextLogStep.objects.filter(
            job__guid=job[0]['job_guid']).order_by(
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
                                  project_specific_id=pk)
        except job.DoesNotExist:
            return Response("No job with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)
        textlog_errors = (TextLogError.objects
                          .filter(step__job=job)
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
            job = Job.objects.get(repository__name=project,
                                  project_specific_id=pk)
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
            job = Job.objects.get(repository=repository,
                                  project_specific_id=pk)
        except ObjectDoesNotExist:
            return Response("No job with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)

        filter_params = request.query_params.copy()

        offset = int(filter_params.get("offset", 0))
        # we don't need a big page size on this endoint,
        # let's cap it to 50 elements
        count = int(filter_params.get("value", 50))

        return_type = filter_params.get("return_type", "dict").lower()

        jobs = JobFilter({k: v for (k, v) in filter_params.iteritems()},
                         queryset=Job.objects.filter(
                             job_type_id=job.job_type_id,
                             repository=repository).exclude(
                                 id=job.id).select_related(
                                     'build_platform',
                                     'job_type',
                                     'job_type__job_group',
                                     'machine_platform',
                                     'machine',
                                     'push__time',
                                     'signature',
                                     'repository')).qs

        # similar jobs we want in descending order from most recent
        jobs = jobs.order_by('-push__time')[offset:count]

        results = serializers.JobSerializer(jobs[offset:count], many=True).data

        response_body = dict(meta={"repository": project}, results=[])

        if results and return_type == "list":
            response_body["job_property_names"] = results[0].keys()
            results = [item.values() for item in results]
        response_body["results"] = results
        response_body["meta"].update(offset=offset, count=count)

        return Response(response_body)

    @with_jobs
    def create(self, request, project, jm):
        """
        This method adds a job to a given resultset.
        """
        jm.store_job_data(request.data)

        return Response({'message': 'Job successfully updated'})


class JobDetailViewSet(viewsets.ReadOnlyModelViewSet):
    '''
    Endpoint for retrieving metadata (e.g. links to artifacts, file sizes)
    associated with a particular job
    '''
    queryset = JobDetail.objects.all().select_related('job__guid',
                                                      'job__project_specific_id',
                                                      'job__repository__name')
    serializer_class = serializers.JobDetailSerializer

    class JobDetailFilter(filters.FilterSet):

        class NumberInFilter(django_filters.filters.BaseInFilter,
                             django_filters.NumberFilter):
            pass

        job_id = django_filters.NumberFilter(name='job__project_specific_id')
        job_id__in = NumberInFilter(name='job__project_specific_id',
                                    lookup_expr='in')
        job_guid = django_filters.CharFilter(name='job__guid')
        job__guid = django_filters.CharFilter(name='job__guid')  # for backwards compat
        title = django_filters.CharFilter(name='title')
        repository = django_filters.CharFilter(name='job__repository__name')

        class Meta:
            model = JobDetail
            fields = ['job_guid', 'job__guid', 'job_id__in', 'title',
                      'repository']

    filter_backends = [filters.DjangoFilterBackend]
    filter_class = JobDetailFilter

    # using a custom pagination size of 2000 to avoid breaking mozscreenshots
    # which doesn't paginate through results yet
    # https://github.com/mnoorenberghe/mozscreenshots/issues/28
    class JobDetailPagination(pagination.IdPagination):
        page_size = 2000

    pagination_class = JobDetailPagination

    # one of these is required
    required_filters = ['job_guid', 'job__guid', 'job_id', 'job_id__in']

    def list(self, request):
        query_param_keys = request.query_params.keys()

        # unfiltered requests can potentially create huge sql queries, so
        # make sure the user passes a job id or guid
        if set(self.required_filters).isdisjoint(set(query_param_keys)):
            raise ParseError("Must filter on one of: {}".format(
                ", ".join(self.required_filters)))
        # passing a job id without repository doesn't currently make sense
        # (it will once we only have one jobs table and job ids are unique)
        if set(['job_id', 'job_id__in']).intersection(query_param_keys) and \
           'repository' not in query_param_keys:
            raise ParseError("Must also filter on repository if filtering "
                             "on job id")

        return viewsets.ReadOnlyModelViewSet.list(self, request)
