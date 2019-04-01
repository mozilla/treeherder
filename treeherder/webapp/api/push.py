import datetime

import newrelic.agent
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.status import (HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)

from treeherder.model.models import (Push,
                                     Repository)
from treeherder.push_health.push_health import get_push_health_test_failures
from treeherder.webapp.api.serializers import PushSerializer
from treeherder.webapp.api.utils import (REPO_GROUPS,
                                         to_datetime,
                                         to_timestamp)


class PushViewSet(viewsets.ViewSet):
    """
    View for ``push`` records
    """

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
        for param in ["fromchange", "tochange", "startdate", "enddate", "revision", "commit_revision"]:
            v = filter_params.get(param, None)
            if v:
                del filter_params[param]
                meta[param] = v

        try:
            repository = Repository.objects.get(name=project)
        except Repository.DoesNotExist:
            return Response({
                "detail": "No project with name {}".format(project)
            }, status=HTTP_404_NOT_FOUND)

        pushes = Push.objects.filter(repository=repository).order_by('-time')

        for (param, value) in meta.items():
            if param == 'fromchange':
                revision_field = 'revision__startswith' if len(value) < 40 else 'revision'
                filter_kwargs = {revision_field: value, 'repository': repository}
                frompush_time = Push.objects.values_list('time', flat=True).get(
                    **filter_kwargs)
                pushes = pushes.filter(time__gte=frompush_time)
                filter_params.update({
                    "push_timestamp__gte": to_timestamp(frompush_time)
                })
                self.report_if_short_revision(param, value)

            elif param == 'tochange':
                revision_field = 'revision__startswith' if len(value) < 40 else 'revision'
                filter_kwargs = {revision_field: value, 'repository': repository}
                topush_time = Push.objects.values_list('time', flat=True).get(
                    **filter_kwargs)
                pushes = pushes.filter(time__lte=topush_time)
                filter_params.update({
                    "push_timestamp__lte": to_timestamp(topush_time)
                })
                self.report_if_short_revision(param, value)

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
                # revision must be the tip revision of the push itself
                revision_field = 'revision__startswith' if len(value) < 40 else 'revision'
                filter_kwargs = {revision_field: value}
                pushes = pushes.filter(**filter_kwargs)
                rev_key = "revisions_long_revision" \
                          if len(meta['revision']) == 40 else "revisions_short_revision"
                filter_params.update({rev_key: meta['revision']})
                self.report_if_short_revision(param, value)
            elif param == 'commit_revision':
                # revision can be either the revision of the push itself, or
                # any of the commits it refers to
                pushes = pushes.filter(commits__revision=value)
                self.report_if_short_revision(param, value)

        for param in ['push_timestamp__lt', 'push_timestamp__lte',
                      'push_timestamp__gt', 'push_timestamp__gte']:
            if filter_params.get(param):
                # translate push timestamp directly into a filter
                try:
                    value = datetime.datetime.fromtimestamp(
                        float(filter_params.get(param)))
                except ValueError:
                    return Response({
                        "detail": "Invalid timestamp specified for {}".format(
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
                    "detail": "Invalid timestamp specified for {}".format(
                        param)
                }, status=HTTP_400_BAD_REQUEST)
            if value:
                pushes = pushes.filter(**{param: value})

        id_in = filter_params.get("id__in")
        if id_in:
            try:
                id_in_list = [int(id) for id in id_in.split(',')]
            except ValueError:
                return Response({"detail": "Invalid id__in specification"},
                                status=HTTP_400_BAD_REQUEST)
            pushes = pushes.filter(id__in=id_in_list)

        author = filter_params.get("author")
        if author:
            pushes = pushes.filter(author=author)

        try:
            count = int(filter_params.get("count", 10))
        except ValueError:
            return Response({"detail": "Valid count value required"},
                            status=HTTP_400_BAD_REQUEST)

        if count > MAX_PUSH_COUNT:
            msg = "Specified count exceeds api limit: {}".format(MAX_PUSH_COUNT)
            return Response({"detail": msg}, status=HTTP_400_BAD_REQUEST)

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

    @action(detail=True)
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

    @action(detail=False)
    def health(self, request, project):
        """
        Return a calculated assessment of the health of this push.
        """
        revision = request.query_params.get('revision')

        try:
            push = Push.objects.get(revision=revision, repository__name=project)
        except Push.DoesNotExist:
            return Response("No push with revision: {0}".format(revision),
                            status=HTTP_404_NOT_FOUND)
        push_health_test_failures = get_push_health_test_failures(push, REPO_GROUPS['trunk'])
        test_result = 'fail' if len(push_health_test_failures['needInvestigation']) else 'pass'

        return Response({
            'revision': revision,
            'id': push.id,
            'result': test_result,
            'metrics': [
                {
                    'name': 'Tests',
                    'result': test_result,
                    'failures': push_health_test_failures,
                },
                {
                    'name': 'Builds (Not yet implemented)',
                    'result': 'pass',
                    'details': ['Wow, everything passed!'],
                },
                {
                    'name': 'Linting (Not yet implemented)',
                    'result': 'pass',
                    'details': ['Gosh, this code is really nicely formatted.'],
                },
                {
                    'name': 'Coverage (Not yet implemented)',
                    'result': 'pass',
                    'details': [
                        'Covered 42% of the tests that are needed for feature ``foo``.',
                        'Covered 100% of the tests that are needed for feature ``bar``.',
                        'The ratio of people to cake is too many...',
                    ],
                },
                {
                    'name': 'Performance (Not yet implemented)',
                    'result': 'pass',
                    'details': ['Ludicrous Speed'],
                },
            ],
        })

    # TODO: Remove when we no longer support short revisions: Bug 1306707
    def report_if_short_revision(self, param, revision):
        if len(revision) < 40:
            newrelic.agent.record_custom_event(
                'short_revision_push_api',
                {'error': 'Revision <40 chars', 'param': param, 'revision': revision}
            )
