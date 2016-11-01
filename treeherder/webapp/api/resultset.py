import datetime

import newrelic.agent
from rest_framework import viewsets
from rest_framework.decorators import detail_route
from rest_framework.exceptions import ParseError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import (HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)

from serializers import (CommitSerializer,
                         PushSerializer)
from treeherder.model.models import (Commit,
                                     Push,
                                     Repository)
from treeherder.model.tasks import publish_resultset_runnable_job_action
from treeherder.webapp.api import permissions
from treeherder.webapp.api.utils import (to_datetime,
                                         to_timestamp,
                                         with_jobs)


class ResultSetViewSet(viewsets.ViewSet):

    """
    View for ``resultset`` records

    ``result sets`` are synonymous with ``pushes`` in the ui
    """
    throttle_scope = 'resultset'
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

    def list(self, request, project):
        """
        GET method for list of ``resultset`` records with revisions
        """
        # What is the upper limit on the number of resultsets returned by the api
        MAX_RESULTS_COUNT = 1000

        # make a mutable copy of these params
        filter_params = request.query_params.copy()

        # This will contain some meta data about the request and results
        meta = {}

        # support ranges for date as well as revisions(changes) like old tbpl
        for param in ["fromchange", "tochange", "startdate", "enddate", "revision"]:
            v = filter_params.get(param, None)
            if v:
                del(filter_params[param])
                meta[param] = v

        try:
            repository = Repository.objects.get(name=project)
        except Repository.DoesNotExist:
            return Response({
                "detail": "No project with name {}".format(project)
            }, status=HTTP_404_NOT_FOUND)

        pushes = Push.objects.filter(repository=repository).order_by('-timestamp')

        for (param, value) in meta.iteritems():
            if param == 'fromchange':
                frompush_timestamp = Push.objects.values_list(
                    'timestamp', flat=True).get(
                        repository=repository, revision__startswith=value)
                pushes = pushes.filter(timestamp__gte=frompush_timestamp)
                filter_params.update({
                    "push_timestamp__gte": to_timestamp(frompush_timestamp)
                })

            elif param == 'tochange':
                topush_timestamp = Push.objects.values_list(
                    'timestamp', flat=True).get(
                        repository=repository, revision__startswith=value)
                pushes = pushes.filter(timestamp__lte=topush_timestamp)
                filter_params.update({
                    "push_timestamp__lte": to_timestamp(topush_timestamp)
                })
            elif param == 'startdate':
                pushes = pushes.filter(timestamp__gte=to_datetime(value))
                filter_params.update({
                    "push_timestamp__gte": to_timestamp(to_datetime(value))
                })
            elif param == 'enddate':
                real_end_date = to_datetime(value) + datetime.timedelta(days=1)
                pushes = pushes.filter(timestamp__lte=real_end_date)
                filter_params.update({
                    "push_timestamp__lt": to_timestamp(real_end_date)
                })
            elif param == 'revision':
                # revision can be either the revision of the push itself, or
                # any of the commits it refers to
                pushes = pushes.filter(commits__revision__startswith=value)
                rev_key = "revisions_long_revision" \
                          if len(meta['revision']) == 40 else "revisions_short_revision"
                filter_params.update({rev_key: meta['revision']})

        id_lt = int(filter_params.get("id__lt", 0))
        if id_lt:
            pushes = pushes.filter(id__lt=id_lt)

        id_in = filter_params.get("id__in")
        if id_in:
            try:
                id_in_list = [int(id) for id in id_in.split(',')]
            except ValueError:
                return Response({"error": "Invalid id__in specification"},
                                status=HTTP_400_BAD_REQUEST)
            pushes = pushes.filter(id__in=id_in_list)

        count = int(filter_params.get("count", 10))

        if count > MAX_RESULTS_COUNT:
            msg = "Specified count exceeds api limit: {}".format(MAX_RESULTS_COUNT)
            return Response({"error": msg}, status=HTTP_400_BAD_REQUEST)

        # we used to have a "full" parameter for this endpoint so you could
        # specify to not fetch the revision information if it was set to
        # false. however AFAIK no one ever used it (default was to fetch
        # everything), so let's just leave it out. it doesn't break
        # anything to send extra data when not required.
        pushes = pushes.select_related('repository').prefetch_related('commits')[:count]
        serializer = PushSerializer(pushes, many=True)

        meta['count'] = len(pushes)
        meta['repository'] = project
        meta['filter_params'] = filter_params

        resp = {
            'meta': meta,
            'results': serializer.data
        }

        return Response(resp)

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for detail view of ``resultset``
        """
        try:
            push = Push.objects.get(repository__name=project,
                                    id=pk)
            serializer = PushSerializer(push)
            return Response(serializer.data)
        except Push.DoesNotExist:
            return Response("No resultset with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)

    @detail_route()
    def revisions(self, request, project, pk=None):
        """
        GET method for revisions of a resultset
        """
        try:
            serializer = CommitSerializer(Commit.objects.filter(push_id=pk),
                                          many=True)
            return Response(serializer.data)
        except Commit.DoesNotExist:
            return Response("No resultset with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def cancel_all(self, request, project, jm, pk=None):
        """
        Cancel all pending and running jobs in this resultset
        """

        if not pk:  # pragma nocover
            return Response({"message": "resultset id required"}, status=HTTP_400_BAD_REQUEST)

        jm.cancel_all_jobs_for_push(request.user.email, pk)
        return Response({"message": "pending and running jobs canceled for resultset '{0}'".format(pk)})

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def trigger_missing_jobs(self, request, project, jm, pk=None):
        """
        Trigger jobs that are missing in a resultset.
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=HTTP_400_BAD_REQUEST)

        jm.trigger_missing_jobs(request.user.email, pk)
        return Response({"message": "Missing jobs triggered for result set '{0}'".format(pk)})

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def trigger_all_talos_jobs(self, request, project, jm, pk=None):
        """
        Trigger all the talos jobs in a resultset.
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=HTTP_400_BAD_REQUEST)

        times = int(request.query_params.get('times', None))
        if not times:
            raise ParseError(detail="The 'times' parameter is mandatory for this endpoint")

        jm.trigger_all_talos_jobs(request.user.email, pk, times)
        return Response({"message": "Talos jobs triggered for result set '{0}'".format(pk)})

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def trigger_runnable_jobs(self, request, project, jm, pk=None):
        """
        Add new jobs to a resultset.
        """
        if not pk:
            return Response({"message": "result set id required"},
                            status=HTTP_400_BAD_REQUEST)

        # Making sure a push with this id exists
        if not Push.objects.filter(id=pk).exists():
            return Response({"message": "No result set with id: {0}".format(pk)},
                            status=HTTP_404_NOT_FOUND)

        requested_jobs = request.data.get('requested_jobs', [])
        decision_task_id = request.data.get('decision_task_id', [])
        if not requested_jobs:
            Response({"message": "The list of requested_jobs cannot be empty"},
                     status=HTTP_400_BAD_REQUEST)

        publish_resultset_runnable_job_action.apply_async(
            args=[project, pk, request.user.email, requested_jobs, decision_task_id],
            routing_key='publish_to_pulse'
        )

        return Response({"message": "New jobs added for push '{0}'".format(pk)})

    @with_jobs
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        # check if any revisions are shorter than the expected 40 characters
        # The volume of resultsets is fairly low, so this loop won't be
        # onerous.
        for resultset in request.data:
            for revision in resultset['revisions']:
                try:
                    if len(revision['revision']) < 40:
                        raise ValueError("Revision < 40 characters")
                except ValueError:
                    # The id of the submitter will be automatically included
                    # in the params via the ``hawk_lookup`` call
                    params = {
                        "revision": revision["revision"]
                    }
                    newrelic.agent.record_exception(params=params)

        jm.store_result_set_data(request.data)

        return Response({"message": "well-formed JSON stored"})

    @detail_route()
    @with_jobs
    def status(self, request, project, jm, pk=None):
        """
        Return a count of the jobs belonging to this push (resultset)
        grouped by job status.
        """
        return Response(jm.get_push_status(pk))
