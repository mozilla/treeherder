import django_filters
from dateutil import parser
from django.core.exceptions import ObjectDoesNotExist
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

from treeherder.model.derived import ArtifactsModel
from treeherder.model.error_summary import get_error_summary
from treeherder.model.models import (FailureLine,
                                     Job,
                                     JobDetail,
                                     JobLog,
                                     OptionCollection,
                                     TextLogError,
                                     TextLogStep,
                                     TextLogSummary)
from treeherder.webapp.api import (pagination,
                                   permissions,
                                   serializers)
from treeherder.webapp.api.utils import (UrlQueryFilter,
                                         with_jobs)


class JobsViewSet(viewsets.ViewSet):

    """
    This viewset is responsible for the jobs endpoint.

    """
    throttle_scope = 'jobs'
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

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

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view

        Return a single job with log_references and
        artifact names and links to the artifact blobs.
        """
        obj = jm.get_job(pk)
        if not obj:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        job = obj[0]
        job["resource_uri"] = reverse("jobs-detail",
                                      kwargs={"project": jm.project, "pk": job["id"]})
        job["logs"] = []
        for (name, url) in JobLog.objects.filter(
                job__repository__name=jm.project,
                job__project_specific_id=job['id']).values_list('name', 'url'):
            job["logs"].append({'name': name, 'url': url})

        # make artifact ids into uris

        with ArtifactsModel(project) as artifacts_model:
            artifact_refs = artifacts_model.get_job_artifact_references(pk)
        job["artifacts"] = []
        for art in artifact_refs:
            ref = reverse("artifact-detail",
                          kwargs={"project": jm.project, "pk": art["id"]})
            art["resource_uri"] = ref
            job["artifacts"].append(art)

        option_hash = job['option_collection_hash']
        if option_hash:
            option_collection_map = self._get_option_collection_map()
            job["platform_option"] = option_collection_map[option_hash]

        return Response(job)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        Optional parameters (default):
        - offset (0)
        - count (10)
        - return_type (dict)
        """
        MAX_JOBS_COUNT = 2000

        filter = UrlQueryFilter(request.query_params)

        offset = int(filter.pop("offset", 0))
        count = int(filter.pop("count", 10))

        if "last_modified" in filter.conditions:
            # could be more than one, this is a set
            for lm in filter.conditions["last_modified"]:
                datestr = lm[1]
                try:
                    # ensure last_modified is a date
                    parser.parse(datestr)
                except ValueError:
                    return Response(
                        "Invalid date value for `last_modified`: {}".format(datestr),
                        status=HTTP_400_BAD_REQUEST)

        if count > MAX_JOBS_COUNT:
            msg = "Specified count exceeds API MAX_JOBS_COUNT value: {}".format(MAX_JOBS_COUNT)
            return Response({"error": msg}, status=HTTP_400_BAD_REQUEST)

        return_type = filter.pop("return_type", "dict").lower()
        exclusion_profile = filter.pop("exclusion_profile", "default")
        visibility = filter.pop("visibility", "included")
        if exclusion_profile in ('false', 'null'):
            exclusion_profile = None
        results = jm.get_job_list(offset, count, conditions=filter.conditions,
                                  exclusion_profile=exclusion_profile,
                                  visibility=visibility)

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
    @with_jobs
    def similar_jobs(self, request, project, jm, pk=None):
        """
        Get a list of jobs similar to the one selected.
        """
        job = jm.get_job(pk)
        if not job:
            return Response("No job with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

        query_params = request.query_params.copy()
        query_params['job_type_id'] = job[0]['job_type_id']
        query_params['id__ne'] = job[0]['id']
        url_query_filter = UrlQueryFilter(query_params)
        offset = int(url_query_filter.pop("offset", 0))
        # we don't need a big page size on this endoint,
        # let's cap it to 50 elements
        count = min(int(url_query_filter.pop("count", 10)), 50)
        return_type = url_query_filter.pop("return_type", "dict").lower()
        results = jm.get_job_list_sorted(offset, count,
                                         conditions=url_query_filter.conditions)

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
