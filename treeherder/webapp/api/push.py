import datetime

from rest_framework import viewsets
from rest_framework.decorators import detail_route
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import (HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)

from serializers import (CommitSerializer,
                         PushSerializer)
from treeherder.model.models import (Commit,
                                     Job,
                                     Push,
                                     Repository)
from treeherder.model.tasks import publish_job_action
from treeherder.webapp.api import permissions
from treeherder.webapp.api.utils import (to_datetime,
                                         to_timestamp)


class PushViewSet(viewsets.ViewSet):

    """
    View for ``push`` records
    """
    throttle_scope = 'push'
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

    def list(self, request, project):
        """
        GET method for list of ``push`` records with revisions
        """
        # What is the upper limit on the number of pushes returned by the api
        MAX_PUSH_COUNT = 1000

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

        pushes = Push.objects.filter(repository=repository).order_by('-time')

        for (param, value) in meta.iteritems():
            if param == 'fromchange':
                frompush_time = Push.objects.values_list('time', flat=True).get(
                    repository=repository, revision__startswith=value)
                pushes = pushes.filter(time__gte=frompush_time)
                filter_params.update({
                    "push_timestamp__gte": to_timestamp(frompush_time)
                })

            elif param == 'tochange':
                topush_time = Push.objects.values_list('time', flat=True).get(
                    repository=repository, revision__startswith=value)
                pushes = pushes.filter(time__lte=topush_time)
                filter_params.update({
                    "push_timestamp__lte": to_timestamp(topush_time)
                })
            elif param == 'startdate':
                pushes = pushes.filter(time__gte=to_datetime(value))
                filter_params.update({
                    "push_timestamp__gte": to_timestamp(to_datetime(value))
                })
            elif param == 'enddate':
                real_end_date = to_datetime(value) + datetime.timedelta(days=1)
                pushes = pushes.filter(time__lte=real_end_date)
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

        for param in ['push_timestamp__lt', 'push_timestamp__lte',
                      'push_timestamp__gt', 'push_timestamp__gte']:
            if filter_params.get(param):
                # translate push timestamp directly into a filter
                try:
                    value = datetime.datetime.fromtimestamp(
                        float(filter_params.get(param)))
                except ValueError:
                    return Response({
                        "error": "Invalid timestamp specified for {}".format(
                            param)
                    }, status=HTTP_400_BAD_REQUEST)
                pushes = pushes.filter(**{
                    param.replace('push_timestamp', 'time'): value
                })

        for param in ['id__lt', 'id__lte', 'id__gt', 'id__gte', 'id']:
            try:
                value = int(filter_params.get(param, 0))
            except ValueError:
                return Response({
                    "error": "Invalid timestamp specified for {}".format(
                        param)
                }, status=HTTP_400_BAD_REQUEST)
            if value:
                pushes = pushes.filter(**{param: value})

        id_in = filter_params.get("id__in")
        if id_in:
            try:
                id_in_list = [int(id) for id in id_in.split(',')]
            except ValueError:
                return Response({"error": "Invalid id__in specification"},
                                status=HTTP_400_BAD_REQUEST)
            pushes = pushes.filter(id__in=id_in_list)

        author = filter_params.get("author")
        if author:
            pushes = pushes.filter(author=author)

        try:
            count = int(filter_params.get("count", 10))
        except ValueError:
            return Response({"error": "Valid count value required"},
                            status=HTTP_400_BAD_REQUEST)

        if count > MAX_PUSH_COUNT:
            msg = "Specified count exceeds api limit: {}".format(MAX_PUSH_COUNT)
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
        GET method implementation for detail view of ``push``
        """
        try:
            push = Push.objects.get(repository__name=project,
                                    id=pk)
            serializer = PushSerializer(push)
            return Response(serializer.data)
        except Push.DoesNotExist:
            return Response("No push with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)

    @detail_route()
    def revisions(self, request, project, pk=None):
        """
        GET method for revisions of a push
        """
        try:
            serializer = CommitSerializer(Commit.objects.filter(push_id=pk),
                                          many=True)
            return Response(serializer.data)
        except Commit.DoesNotExist:
            return Response("No push with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    def cancel_all(self, request, project, pk=None):
        """
        Cancel all pending and running jobs in this push
        """
        if not pk:  # pragma nocover
            return Response({"message": "push id required"}, status=HTTP_400_BAD_REQUEST)

        # Notify the build systems which created these jobs...
        for job in Job.objects.filter(push_id=pk).exclude(state='completed'):
            publish_job_action.apply_async(
                args=[project, 'cancel', job.id, request.user.email],
                routing_key='publish_to_pulse'
            )

        # Mark pending jobs as cancelled to work around buildbot not including
        # cancelled jobs in builds-4hr if they never started running.
        # TODO: Remove when we stop using buildbot.
        Job.objects.filter(push_id=pk, state='pending').update(
            state='completed',
            result='usercancel',
            last_modified=datetime.datetime.now())

        return Response({"message": "pending and running jobs canceled for push '{0}'".format(pk)})

    @detail_route()
    def status(self, request, project, pk=None):
        """
        Return a count of the jobs belonging to this push
        grouped by job status.
        """
        try:
            push = Push.objects.get(id=pk)
        except Push.DoesNotExist:
            return Response("No push with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)
        return Response(push.get_status())
