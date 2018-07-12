from __future__ import division

import datetime
import logging
import time
from collections import defaultdict

import django_filters
from django.conf import settings
from django.db import transaction
from rest_framework import (exceptions,
                            filters,
                            pagination,
                            viewsets)
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.model import models
from treeherder.perf.alerts import get_alert_properties
from treeherder.perf.models import (IssueTracker,
                                    PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceBugTemplate,
                                    PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)
from treeherder.webapp.api.permissions import IsStaffOrReadOnly

from .exceptions import InsufficientAlertCreationData
from .performance_serializers import (IssueTrackerSerializer,
                                      PerformanceAlertSerializer,
                                      PerformanceAlertSummarySerializer,
                                      PerformanceBugTemplateSerializer,
                                      PerformanceFrameworkSerializer)

logger = logging.getLogger(__name__)


class PerformanceSignatureViewSet(viewsets.ViewSet):

    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)

        signature_data = PerformanceSignature.objects.filter(
            repository=repository).select_related(
                'parent_signature__signature_hash', 'option_collection',
                'platform')

        parent_signature_hashes = request.query_params.getlist('parent_signature')
        if parent_signature_hashes:
            parent_signatures = PerformanceSignature.objects.filter(
                repository=repository,
                signature_hash__in=parent_signature_hashes)
            signature_data = signature_data.filter(
                parent_signature__in=parent_signatures)

        if not int(request.query_params.get('subtests', True)):
            signature_data = signature_data.filter(parent_signature__isnull=True)

        signature_ids = request.query_params.getlist('id')
        if signature_ids:
            signature_data = signature_data.filter(id__in=map(int,
                                                              signature_ids))

        signature_hashes = request.query_params.getlist('signature')
        if signature_hashes:
            signature_data = signature_data.filter(
                signature_hash__in=signature_hashes)

        frameworks = request.query_params.getlist('framework')
        if frameworks:
            signature_data = signature_data.filter(
                framework__in=frameworks)

        interval = request.query_params.get('interval')
        start_date = request.query_params.get('start_date')  # 'YYYY-MM-DDTHH:MM:SS
        end_date = request.query_params.get('end_date')  # 'YYYY-MM-DDTHH:MM:SS'
        if interval and (start_date or end_date):
            return Response({"message": "Provide either interval only -or- start (and end) date"},
                            status=HTTP_400_BAD_REQUEST)

        if interval:
            signature_data = signature_data.filter(
                last_updated__gte=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))))

        if start_date:
            signature_data = signature_data.filter(last_updated__gte=start_date)
        if end_date:
            signature_data = signature_data.filter(last_updated__lte=end_date)

        platform = request.query_params.get('platform')
        if platform:
            platforms = models.MachinePlatform.objects.filter(
                platform=platform)
            signature_data = signature_data.filter(
                platform__in=platforms)

        ret = {}
        for (id, signature_hash, option_collection_hash, platform, framework,
             suite, test, lower_is_better, extra_options,
             has_subtests, parent_signature_hash) in signature_data.values_list(
                 'id',
                 'signature_hash',
                 'option_collection__option_collection_hash',
                 'platform__platform', 'framework', 'suite',
                 'test', 'lower_is_better',
                 'extra_options', 'has_subtests',
                 'parent_signature__signature_hash').distinct():
            ret[signature_hash] = {
                'id': id,
                'framework_id': framework,
                'option_collection_hash': option_collection_hash,
                'machine_platform': platform,
                'suite': suite
            }
            if not lower_is_better:
                # almost always true, save some banwidth by assuming that by
                # default
                ret[signature_hash]['lower_is_better'] = False
            if test:
                # test may be empty in case of a summary test, leave it empty
                # then
                ret[signature_hash]['test'] = test
            if has_subtests:
                ret[signature_hash]['has_subtests'] = True
            if parent_signature_hash:
                # this value is often null, save some bandwidth by excluding
                # it if not present
                ret[signature_hash]['parent_signature'] = parent_signature_hash

            if extra_options:
                # extra_options stored as charField but api returns as list
                ret[signature_hash]['extra_options'] = extra_options.split(' ')

        return Response(ret)


class PerformancePlatformViewSet(viewsets.ViewSet):
    """
    All platforms for a particular branch that have performance data
    """
    def list(self, request, project):
        signature_data = PerformanceSignature.objects.filter(
            repository__name=project)
        interval = request.query_params.get('interval')
        if interval:
            signature_data = signature_data.filter(
                last_updated__gte=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))))

        frameworks = request.query_params.getlist('framework')
        if frameworks:
            signature_data = signature_data.filter(
                framework__in=frameworks)

        return Response(signature_data.values_list(
            'platform__platform', flat=True).distinct())


class PerformanceFrameworkViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PerformanceFramework.objects.all()
    serializer_class = PerformanceFrameworkSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = 'id'


class PerformanceDatumViewSet(viewsets.ViewSet):
    """
    This view serves performance test result data
    """
    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)

        signature_hashes = request.query_params.getlist("signatures")  # deprecated
        signature_ids = request.query_params.getlist("signature_id")
        push_ids = request.query_params.getlist("push_id")
        try:
            job_ids = [int(job_id) for job_id in
                       request.query_params.getlist("job_id")]
        except ValueError:
            return Response({"message": "Job id(s) must be specified as integers"},
                            status=HTTP_400_BAD_REQUEST)

        if not (signature_ids or signature_hashes or push_ids or job_ids):
            raise exceptions.ValidationError('Need to specify either '
                                             'signature_id, signatures, '
                                             'push_id, or job_id')
        if signature_ids and signature_hashes:
            raise exceptions.ValidationError('Can\'t specify both signature_id '
                                             'and signatures in same query')

        datums = PerformanceDatum.objects.filter(
            repository=repository).select_related(
                'signature__signature_hash').order_by('push_timestamp')

        if signature_hashes:
            signature_ids = PerformanceSignature.objects.filter(
                repository=repository,
                signature_hash__in=signature_hashes).values_list('id', flat=True)
            datums = datums.filter(signature__id__in=list(signature_ids))
        elif signature_ids:
            datums = datums.filter(signature__id__in=list(signature_ids))
        if push_ids:
            datums = datums.filter(push_id__in=push_ids)
        if job_ids:
            datums = datums.filter(job_id__in=job_ids)

        frameworks = request.query_params.getlist('framework')
        if frameworks:
            datums = datums.filter(
                signature__framework__in=frameworks)

        interval = request.query_params.get('interval')
        start_date = request.query_params.get('start_date')  # 'YYYY-MM-DDTHH:MM:SS
        end_date = request.query_params.get('end_date')  # 'YYYY-MM-DDTHH:MM:SS'
        if interval and (start_date or end_date):
            return Response({"message": "Provide either interval only -or- start (and end) date"},
                            status=HTTP_400_BAD_REQUEST)

        if interval:
            datums = datums.filter(
                push_timestamp__gt=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))))

        if start_date:
            datums = datums.filter(push_timestamp__gt=start_date)
        if end_date:
            datums = datums.filter(push_timestamp__lt=end_date)

        ret = defaultdict(list)
        values_list = datums.values_list(
            'id', 'signature_id', 'signature__signature_hash', 'job_id', 'push_id',
            'push_timestamp', 'value')
        for (id, signature_id, signature_hash, job_id, push_id,
             push_timestamp, value) in values_list:
            ret[signature_hash].append({
                'id': id,
                'signature_id': signature_id,
                'job_id': job_id,
                'push_id': push_id,
                'push_timestamp': int(time.mktime(push_timestamp.timetuple())),
                'value': round(value, 2)  # round to 2 decimal places
            })

        return Response(ret)


class AlertSummaryPagination(pagination.PageNumberPagination):
    ordering = ('-last_updated', '-id')
    page_size = 10


class PerformanceAlertSummaryViewSet(viewsets.ModelViewSet):
    """ViewSet for the performance alert summary model"""
    queryset = PerformanceAlertSummary.objects.filter(repository__active_status='active').prefetch_related(
        'alerts', 'alerts__series_signature',
        'repository',
        'alerts__series_signature__platform',
        'alerts__series_signature__option_collection',
        'alerts__series_signature__option_collection__option')
    permission_classes = (IsStaffOrReadOnly,)

    serializer_class = PerformanceAlertSummarySerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filter_fields = ['id', 'status', 'framework', 'repository',
                     'alerts__series_signature',
                     'alerts__series_signature__signature_hash']
    ordering = ('-last_updated', '-id')
    pagination_class = AlertSummaryPagination

    def create(self, request, *args, **kwargs):
        data = request.data

        alert_summary, _ = PerformanceAlertSummary.objects.get_or_create(
            repository_id=data['repository_id'],
            framework=PerformanceFramework.objects.get(id=data['framework_id']),
            push_id=data['push_id'],
            prev_push_id=data['prev_push_id'],
            defaults={
                'manually_created': True,
                'last_updated': datetime.datetime.now()
            })

        return Response({"alert_summary_id": alert_summary.id})


class PerformanceAlertViewSet(viewsets.ModelViewSet):
    queryset = PerformanceAlert.objects.all()
    permission_classes = (IsStaffOrReadOnly,)

    serializer_class = PerformanceAlertSerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filter_fields = ['id']
    ordering = ('-id')

    class AlertPagination(pagination.CursorPagination):
        ordering = ('-id')
        page_size = 10

    pagination_class = AlertPagination

    def update(self, request, *args, **kwargs):
        data = request.data  # comment

        new_push_id = data.get('push_id')
        new_prev_push_id = data.get('prev_push_id')
        if new_push_id is None and new_prev_push_id is None:
            logger.warning('Updating if-branch...')
            data['classifier'] = request.user.username
            return super(PerformanceAlertViewSet, self).update(request, *args, **kwargs)
        else:
            logger.warning('Nudging if-branch...')
            alert = PerformanceAlert.objects.get(pk=kwargs['pk'])
            logger.warning('alert {0} with id={1.id}'.format(str(alert), alert))
            if all([new_push_id, new_prev_push_id]) and alert.summary.push.id != new_push_id:
                return self.nudge(alert, new_push_id, new_prev_push_id)

            return Response({"message": "Incorrect push was provided"},
                            status=HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        data = request.data
        if 'summary_id' not in data or 'signature_id' not in data:
            return Response({"message": "Summary and signature ids necessary "
                             "to create alert"}, status=HTTP_400_BAD_REQUEST)

        summary = PerformanceAlertSummary.objects.get(
            id=data['summary_id'])
        signature = PerformanceSignature.objects.get(
            id=data['signature_id'])

        alert_properties = self.calculate_alert_properties(summary, signature)

        alert, _ = PerformanceAlert.objects.get_or_create(
            summary=summary,
            series_signature=signature,
            defaults={
                'is_regression': alert_properties.is_regression,
                'manually_created': True,
                'amount_pct': alert_properties.pct_change,
                'amount_abs': alert_properties.delta,
                'prev_value': alert_properties.prev_value,
                'new_value': alert_properties.new_value,
                't_value': 1000
            })
        return Response({"alert_id": alert.id})

    def calculate_alert_properties(self, alert_summary, series_signature):
        logger.warning('Calculating alert properties...')
        prev_range = series_signature.max_back_window
        if not prev_range:
            prev_range = settings.PERFHERDER_ALERTS_MAX_BACK_WINDOW
        new_range = series_signature.fore_window
        if not new_range:
            new_range = settings.PERFHERDER_ALERTS_FORE_WINDOW

        logger.warning('towards AlertSummary(id={0.id}, prev_push_id={0.prev_push.id}, push_id={0.push_id}, prev_push.time={0.prev_push.time})'
                       .format(alert_summary))
        prev_data = PerformanceDatum.objects.filter(
            signature=series_signature,
            push_timestamp__lte=alert_summary.prev_push.time).order_by(
                '-push_timestamp')
        prev_values = prev_data.values_list('value', flat=True)[:prev_range]

        new_data = PerformanceDatum.objects.filter(
            signature=series_signature,
            push_timestamp__gt=alert_summary.prev_push.time).order_by(
                'push_timestamp')
        new_values = new_data.values_list('value', flat=True)[:new_range]

        logger.warning('prev_data: {0}'.format(prev_data))
        logger.warning('new_data: {0}'.format(new_data))

        if not prev_data or not new_data:
            raise InsufficientAlertCreationData

        prev_value = sum(prev_values)/len(prev_values)
        new_value = sum(new_values)/len(new_values)

        return get_alert_properties(prev_value, new_value,
                                    series_signature.lower_is_better)

    @transaction.atomic
    def nudge(self, alert, new_push_id, new_prev_push_id):
        logger.warning('Nudging alert...')
        alert_summary, new_summary = PerformanceAlertSummary.objects.get_or_create(
            push_id=new_push_id,
            prev_push_id=new_prev_push_id,
            repository=alert.summary.repository,
            framework=alert.summary.framework,
            defaults={
                'last_updated': datetime.datetime.now()
            })
        old_summary = alert.summary
        logger.warning('alert_summary={0}, new_summary={1}'.format(str(alert_summary), new_summary))

        conflicting_alert = alert_summary.alerts.filter(
                series_signature=alert.series_signature).first()

        if (not new_summary) and conflicting_alert:
            # discard nudged alert to use similar one instead
            logger.warning('Discard nudged alert to use similar one instead')
            alert.delete()
        else:
            logger.warning('Modifying existing alert...')
            alert.summary = alert_summary

            # update deltas as well
            alert_properties = self.calculate_alert_properties(alert_summary, alert.series_signature)
            alert.is_regression = alert_properties.is_regression
            alert.amount_pct = alert_properties.pct_change
            alert.amount_abs = alert_properties.delta
            alert.prev_value = alert_properties.prev_value
            alert.new_value = alert_properties.new_value

            alert.save()

        if old_summary.alerts.count() == 0:
            old_summary.delete()
            logger.warning('Deleted old summary')
        return Response({'alert_summary_id': alert_summary.id})


class PerformanceBugTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PerformanceBugTemplate.objects.all()
    serializer_class = PerformanceBugTemplateSerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filter_fields = ['framework']


class PerformanceIssueTrackerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IssueTracker.objects.all()
    serializer_class = IssueTrackerSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = 'id'
