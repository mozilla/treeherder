import datetime
import logging

import newrelic.agent
from cache_memoize import cache_memoize
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.status import (HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)

from treeherder.model.models import (Job,
                                     JobType,
                                     Push,
                                     Repository)
from treeherder.push_health.builds import get_build_failures
from treeherder.push_health.compare import get_commit_history
from treeherder.push_health.linting import get_lint_failures
from treeherder.push_health.tests import get_test_failures
from treeherder.push_health.usage import get_usage
from treeherder.webapp.api.serializers import PushSerializer
from treeherder.webapp.api.utils import (to_datetime,
                                         to_timestamp)

logger = logging.getLogger(__name__)


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
    def health_summary(self, request, project):
        """
        Return a calculated summary of the health of this push.
        """
        revision = request.query_params.get('revision')

        try:
            push = Push.objects.get(revision=revision, repository__name=project)
        except Push.DoesNotExist:
            return Response("No push with revision: {0}".format(revision),
                            status=HTTP_404_NOT_FOUND)

        push_health_test_failures = get_test_failures(push)
        push_health_lint_failures = get_lint_failures(push)
        push_health_build_failures = get_build_failures(push)

        return Response({
            'needInvestigation':
                len(push_health_test_failures['needInvestigation']) +
                len(push_health_build_failures) +
                len(push_health_lint_failures),
            'unsupported': len(push_health_test_failures['unsupported']),
        })

    @action(detail=False)
    def health_usage(self, request, project):
        usage = get_usage()
        return Response({'usage': usage})

    @action(detail=False)
    def health(self, request, project):
        """
        Return a calculated assessment of the health of this push.
        """
        revision = request.query_params.get('revision')

        try:
            repository = Repository.objects.get(name=project)
            push = Push.objects.get(revision=revision, repository=repository)
        except Push.DoesNotExist:
            return Response("No push with revision: {0}".format(revision),
                            status=HTTP_404_NOT_FOUND)

        commit_history_details = None
        parent_push = None

        # Parent compare only supported for Hg at this time.
        # Bug https://bugzilla.mozilla.org/show_bug.cgi?id=1612645
        if repository.dvcs_type == 'hg':
            commit_history_details = get_commit_history(repository, revision, push)
            if commit_history_details['exactMatch']:
                parent_push = commit_history_details.pop('parentPush')

        push_health_test_failures = get_test_failures(push, parent_push)
        test_result = 'pass'
        if len(push_health_test_failures['unsupported']):
            test_result = 'indeterminate'
        if len(push_health_test_failures['needInvestigation']):
            test_result = 'fail'

        build_failures = get_build_failures(push, parent_push)
        build_result = 'fail' if len(build_failures) else 'pass'

        lint_failures = get_lint_failures(push)
        lint_result = 'fail' if len(lint_failures) else 'pass'

        push_result = 'pass'
        for metric_result in [test_result, lint_result, build_result]:
            if metric_result == 'indeterminate' and push_result != 'fail':
                push_result = metric_result
            elif metric_result == 'fail':
                push_result = metric_result

        newrelic.agent.record_custom_event('push_health_need_investigation', {
            'revision': revision,
            'repo': repository.name,
            'needInvestigation': len(push_health_test_failures['needInvestigation']),
            'unsupported': len(push_health_test_failures['unsupported']),
            'author': push.author,
        })

        return Response({
            'revision': revision,
            'id': push.id,
            'result': push_result,
            'metrics': {
                'commitHistory': {
                    'name': 'Commit History',
                    'result': 'none',
                    'details': commit_history_details,
                },
                'linting': {
                    'name': 'Linting',
                    'result': lint_result,
                    'details': lint_failures,
                },
                'tests': {
                    'name': 'Tests',
                    'result': test_result,
                    'details': push_health_test_failures,
                },
                'builds': {
                    'name': 'Builds',
                    'result': build_result,
                    'details': build_failures,
                },
            },
            'status': push.get_status(),
        })

    @cache_memoize(60 * 60)
    def get_decision_jobs(self, push_ids):
        job_types = JobType.objects.filter(
            name__endswith='Decision Task',
            symbol='D'
        )
        return Job.objects.filter(
            push_id__in=push_ids,
            job_type__in=job_types,
            result='success',
        ).select_related('taskcluster_metadata')

    @action(detail=False)
    def decisiontask(self, request, project):
        """
        Return the decision task ids for the pushes.
        """
        push_ids = self.request.query_params.get('push_ids', '').split(',')
        decision_jobs = self.get_decision_jobs(push_ids)

        if decision_jobs:
            return Response(
                {job.push_id: {
                    'id': job.taskcluster_metadata.task_id,
                    'run': job.guid.split('/')[1],
                } for job in decision_jobs}
            )
        logger.error('/decisiontask/ found no decision jobs for {}'.format(push_ids))
        self.get_decision_jobs.invalidate(push_ids)
        return Response("No decision tasks found for pushes: {}".format(push_ids),
                        status=HTTP_404_NOT_FOUND)

    # TODO: Remove when we no longer support short revisions: Bug 1306707
    def report_if_short_revision(self, param, revision):
        if len(revision) < 40:
            newrelic.agent.record_custom_event(
                'short_revision_push_api',
                {'error': 'Revision <40 chars', 'param': param, 'revision': revision}
            )
