import datetime
import json
import time
from collections import defaultdict

from rest_framework import (exceptions,
                            filters,
                            pagination,
                            viewsets)
from rest_framework.response import Response

from performance_serializers import (PerformanceAlertSerializer,
                                     PerformanceAlertSummarySerializer,
                                     PerformanceFrameworkSerializer)
from treeherder.model import models
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)
from treeherder.webapp.api.permissions import IsStaffOrReadOnly


class PerformanceSignatureViewSet(viewsets.ViewSet):

    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)

        signature_data = PerformanceSignature.objects.filter(
            repository=repository).select_related(
                'option_collection', 'platform')

        # filter based on signature hashes, if asked
        signature_hashes = request.query_params.getlist('signature')
        if signature_hashes:
            signature_ids = PerformanceSignature.objects.filter(
                signature_hash__in=signature_hashes).values_list('id', flat=True)
            signature_data = signature_data.filter(id__in=list(
                signature_ids))

        interval = request.query_params.get('interval')
        if interval:
            signature_data = signature_data.filter(
                last_updated__gte=datetime.datetime.fromtimestamp(
                    int(time.time() - int(interval))))

        platform = request.query_params.get('platform')
        if platform:
            platforms = models.MachinePlatform.objects.filter(
                platform=platform)
            signature_data = signature_data.filter(
                platform__in=platforms)

        ret = {}
        for (signature_hash, option_collection_hash, platform, framework,
             suite, test, lower_is_better,
             extra_properties) in signature_data.values_list(
                 'signature_hash',
                 'option_collection__option_collection_hash',
                 'platform__platform', 'framework', 'suite',
                 'test', 'lower_is_better', 'extra_properties').distinct():
            ret[signature_hash] = {
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
            else:
                # if it's a summary test, we will query subtests signature for it
                summary_signature = signature_data.get(signature_hash=signature_hash)
                ret[signature_hash]['subtest_signatures'] = summary_signature.subtests.values_list(
                    'signature_hash', flat=True)
            ret[signature_hash].update(json.loads(extra_properties))

        return Response(ret)


class PerformancePlatformViewSet(viewsets.ViewSet):
    """
    All platforms for a particular branch that have performance data
    """
    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)
        return Response(PerformanceSignature.objects.filter(
            repository=repository).values_list(
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

        signature_hashes = request.query_params.getlist("signatures")
        result_set_ids = request.query_params.getlist("result_set_id")
        job_ids = request.query_params.getlist("job_id")

        if not (signature_hashes or result_set_ids or job_ids):
            raise exceptions.ValidationError('Need to specify either '
                                             'signatures, result_set_id, or '
                                             'job_id')

        datums = PerformanceDatum.objects.filter(
            repository=repository).select_related(
                'signature__signature_hash').order_by('push_timestamp')

        if signature_hashes:
            signature_ids = PerformanceSignature.objects.filter(
                repository=repository,
                signature_hash__in=signature_hashes).values_list('id', flat=True)
            datums = datums.filter(signature__id__in=list(signature_ids))
        if result_set_ids:
            datums = datums.filter(result_set_id__in=result_set_ids)
        if job_ids:
            datums = datums.filter(job_id__in=job_ids)

        interval = request.query_params.get('interval')
        if interval:
            datums = datums.filter(
                push_timestamp__gt=datetime.datetime.fromtimestamp(
                    int(time.time() - int(interval))))

        ret = defaultdict(list)
        values_list = datums.values_list(
            'signature__signature_hash', 'job_id', 'result_set_id',
            'push_timestamp', 'value')
        for (signature_hash, job_id, result_set_id, push_timestamp,
             value) in values_list:
            ret[signature_hash].append({
                'job_id': job_id,
                'result_set_id': result_set_id,
                'push_timestamp': int(time.mktime(push_timestamp.timetuple())),
                'value': round(value, 2)  # round to 2 decimal places
            })

        return Response(ret)


class AlertSummaryPagination(pagination.CursorPagination):
    ordering = ('-last_updated', '-id')
    page_size = 10


class PerformanceAlertSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the performance alert summary model"""
    queryset = PerformanceAlertSummary.objects.all().prefetch_related(
        'alerts', 'alerts__series_signature',
        'repository',
        'alerts__series_signature__platform',
        'alerts__series_signature__option_collection',
        'alerts__series_signature__option_collection__option')

    serializer_class = PerformanceAlertSummarySerializer
    filter_backends = (filters.DjangoFilterBackend, filters.OrderingFilter)
    filter_fields = ['id']
    ordering = ('-last_updated', '-id')
    pagination_class = AlertSummaryPagination


class PerformanceAlertViewSet(viewsets.ModelViewSet):
    queryset = PerformanceAlert.objects.all()
    permission_classes = (IsStaffOrReadOnly,)

    serializer_class = PerformanceAlertSerializer
    filter_backends = (filters.DjangoFilterBackend, filters.OrderingFilter)
    filter_fields = ['id']
    ordering = ('-id')

    class AlertPagination(pagination.CursorPagination):
        ordering = ('-id')
        page_size = 10

    pagination_class = AlertPagination
