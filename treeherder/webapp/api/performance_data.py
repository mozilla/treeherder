import datetime
import time
from collections import defaultdict

import django_filters
from django.conf import settings
from django.db import transaction
from django.db.models import CharField, Count, Q, Subquery, Value
from django.db.models.functions import Concat
from rest_framework import exceptions, filters, generics, pagination, viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.model import models
from treeherder.perf.alerts import get_alert_properties
from treeherder.perf.models import (
    IssueTracker,
    OptionCollection,
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceBugTemplate,
    PerformanceDatum,
    PerformanceFramework,
    PerformanceSignature,
)
from treeherder.webapp.api.permissions import IsStaffOrReadOnly

from .exceptions import InsufficientAlertCreationData
from .performance_serializers import (
    IssueTrackerSerializer,
    PerformanceAlertSerializer,
    PerformanceAlertSummarySerializer,
    PerformanceBugTemplateSerializer,
    PerformanceFrameworkSerializer,
    PerformanceQueryParamsSerializer,
    PerformanceSummarySerializer,
    TestSuiteHealthParamsSerializer,
    TestSuiteHealthSerializer,
)
from .utils import GroupConcat


class PerformanceSignatureViewSet(viewsets.ViewSet):
    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)

        signature_data = PerformanceSignature.objects.filter(repository=repository).select_related(
            'parent_signature__signature_hash', 'option_collection', 'platform'
        )

        parent_signature_hashes = request.query_params.getlist('parent_signature')
        if parent_signature_hashes:
            parent_signatures = PerformanceSignature.objects.filter(
                repository=repository, signature_hash__in=parent_signature_hashes
            )
            signature_data = signature_data.filter(parent_signature__in=parent_signatures)

        if not int(request.query_params.get('subtests', True)):
            signature_data = signature_data.filter(parent_signature__isnull=True)

        signature_ids = request.query_params.getlist('id')
        if signature_ids:
            try:
                signature_data = signature_data.filter(id__in=map(int, signature_ids))
            except ValueError:
                return Response(
                    {"message": "One or more id values invalid (must be integer)"},
                    status=HTTP_400_BAD_REQUEST,
                )

        signature_hashes = request.query_params.getlist('signature')
        if signature_hashes:
            signature_data = signature_data.filter(signature_hash__in=signature_hashes)

        frameworks = request.query_params.getlist('framework')
        if frameworks:
            signature_data = signature_data.filter(framework__in=frameworks)

        interval = request.query_params.get('interval')
        start_date = request.query_params.get('start_date')  # 'YYYY-MM-DDTHH:MM:SS
        end_date = request.query_params.get('end_date')  # 'YYYY-MM-DDTHH:MM:SS'
        if interval and (start_date or end_date):
            return Response(
                {"message": "Provide either interval only -or- start (and end) date"},
                status=HTTP_400_BAD_REQUEST,
            )

        if interval:
            signature_data = signature_data.filter(
                last_updated__gte=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))
                )
            )

        if start_date:
            signature_data = signature_data.filter(last_updated__gte=start_date)
        if end_date:
            signature_data = signature_data.filter(last_updated__lte=end_date)

        platform = request.query_params.get('platform')
        if platform:
            platforms = models.MachinePlatform.objects.filter(platform=platform)
            signature_data = signature_data.filter(platform__in=platforms)

        ret = {}
        for (
            id,
            signature_hash,
            option_collection_hash,
            platform,
            framework,
            suite,
            test,
            application,
            lower_is_better,
            extra_options,
            measurement_unit,
            has_subtests,
            tags,
            parent_signature_hash,
        ) in signature_data.values_list(
            'id',
            'signature_hash',
            'option_collection__option_collection_hash',
            'platform__platform',
            'framework',
            'suite',
            'test',
            'application',
            'lower_is_better',
            'extra_options',
            'measurement_unit',
            'has_subtests',
            'tags',
            'parent_signature__signature_hash',
        ).distinct():
            ret[signature_hash] = {
                'id': id,
                'framework_id': framework,
                'option_collection_hash': option_collection_hash,
                'machine_platform': platform,
                'suite': suite,
            }
            if not lower_is_better:
                # almost always true, save some banwidth by assuming that by
                # default
                ret[signature_hash]['lower_is_better'] = False
            if test:
                # test may be empty in case of a summary test, leave it empty
                # then
                ret[signature_hash]['test'] = test
            if application:
                ret[signature_hash]['application'] = application
            if has_subtests:
                ret[signature_hash]['has_subtests'] = True
            if tags:
                # tags stored as charField but api returns as list
                ret[signature_hash]['tags'] = tags.split(' ')
            if parent_signature_hash:
                # this value is often null, save some bandwidth by excluding
                # it if not present
                ret[signature_hash]['parent_signature'] = parent_signature_hash

            if extra_options:
                # extra_options stored as charField but api returns as list
                ret[signature_hash]['extra_options'] = extra_options.split(' ')
            if measurement_unit:
                ret[signature_hash]['measurement_unit'] = measurement_unit

        return Response(ret)


class PerformancePlatformViewSet(viewsets.ViewSet):
    """
    All platforms for a particular branch that have performance data
    """

    def list(self, request, project):
        signature_data = PerformanceSignature.objects.filter(repository__name=project)
        interval = request.query_params.get('interval')
        if interval:
            signature_data = signature_data.filter(
                last_updated__gte=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))
                )
            )

        frameworks = request.query_params.getlist('framework')
        if frameworks:
            signature_data = signature_data.filter(framework__in=frameworks)

        return Response(signature_data.values_list('platform__platform', flat=True).distinct())


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
            job_ids = [int(job_id) for job_id in request.query_params.getlist("job_id")]
        except ValueError:
            return Response(
                {"message": "Job id(s) must be specified as integers"}, status=HTTP_400_BAD_REQUEST
            )

        if not (signature_ids or signature_hashes or push_ids or job_ids):
            raise exceptions.ValidationError(
                'Need to specify either ' 'signature_id, signatures, ' 'push_id, or job_id'
            )
        if signature_ids and signature_hashes:
            raise exceptions.ValidationError(
                'Can\'t specify both signature_id ' 'and signatures in same query'
            )

        datums = PerformanceDatum.objects.filter(repository=repository).select_related(
            'signature', 'push'
        )

        if signature_hashes:
            signature_ids = PerformanceSignature.objects.filter(
                repository=repository, signature_hash__in=signature_hashes
            ).values_list('id', flat=True)

            datums = datums.filter(signature__id__in=list(signature_ids))
        elif signature_ids:
            datums = datums.filter(signature__id__in=list(signature_ids))
        if push_ids:
            datums = datums.filter(push_id__in=push_ids)
        if job_ids:
            datums = datums.filter(job_id__in=job_ids)

        frameworks = request.query_params.getlist('framework')
        if frameworks:
            datums = datums.filter(signature__framework__in=frameworks)

        interval = request.query_params.get('interval')
        start_date = request.query_params.get('start_date')  # 'YYYY-MM-DDTHH:MM:SS
        end_date = request.query_params.get('end_date')  # 'YYYY-MM-DDTHH:MM:SS'
        if interval and (start_date or end_date):
            return Response(
                {"message": "Provide either interval only -or- start (and end) date"},
                status=HTTP_400_BAD_REQUEST,
            )

        if interval:
            datums = datums.filter(
                push_timestamp__gt=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))
                )
            )

        if start_date:
            datums = datums.filter(push_timestamp__gt=start_date)
        if end_date:
            datums = datums.filter(push_timestamp__lt=end_date)

        ret = defaultdict(list)
        values_list = datums.values_list(
            'id',
            'signature_id',
            'signature__signature_hash',
            'job_id',
            'push_id',
            'push_timestamp',
            'value',
            'push__revision',
        )
        for (
            id,
            signature_id,
            signature_hash,
            job_id,
            push_id,
            push_timestamp,
            value,
            push__revision,
        ) in values_list:
            ret[signature_hash].append(
                {
                    'id': id,
                    'signature_id': signature_id,
                    'job_id': job_id,
                    'push_id': push_id,
                    'revision': push__revision,
                    'push_timestamp': int(time.mktime(push_timestamp.timetuple())),
                    'value': round(value, 2),  # round to 2 decimal places
                }
            )

        return Response(ret)


class AlertSummaryPagination(pagination.PageNumberPagination):
    ordering = ('-created', '-id')
    page_size = 10


class PerformanceAlertSummaryFilter(django_filters.FilterSet):
    id = django_filters.NumberFilter(field_name='id')
    status = django_filters.NumberFilter(field_name='status')
    framework = django_filters.NumberFilter(field_name='framework')
    repository = django_filters.NumberFilter(field_name='repository')
    alerts__series_signature = django_filters.NumberFilter(field_name='alerts__series_signature')
    filter_text = django_filters.CharFilter(method='_filter_text')
    hide_improvements = django_filters.BooleanFilter(method='_hide_improvements')
    hide_related_and_invalid = django_filters.BooleanFilter(method='_hide_related_and_invalid')
    with_assignee = django_filters.CharFilter(method='_with_assignee')

    def _filter_text(self, queryset, name, value):
        sep = Value(' ')
        words = value.split(' ')

        contains_all_words = [Q(full_name__contains=word) for word in words]

        # Django's distinct(*fields) isn't supported for MySQL
        # https://code.djangoproject.com/ticket/17974
        filtered_summaries = (
            queryset.annotate(
                full_name=Concat(
                    'alerts__series_signature__suite',
                    sep,
                    'alerts__series_signature__test',
                    sep,
                    'alerts__series_signature__platform__platform',
                    sep,
                    'alerts__series_signature__extra_options',
                    sep,
                    'bug_number',
                    sep,
                    'push__revision',
                    output_field=CharField(),
                )
            )
            .filter(*contains_all_words)
            .values('id')
            .distinct()
        )

        return queryset.filter(id__in=Subquery(filtered_summaries))

    def _hide_improvements(self, queryset, name, value):
        return queryset.annotate(total_regressions=Count('alerts__is_regression')).filter(
            alerts__is_regression=True, total_regressions__gte=1
        )

    def _hide_related_and_invalid(self, queryset, name, value):
        return queryset.exclude(
            status__in=[
                PerformanceAlertSummary.DOWNSTREAM,
                PerformanceAlertSummary.REASSIGNED,
                PerformanceAlertSummary.INVALID,
            ]
        )

    def _with_assignee(self, queryset, name, value):
        return queryset.filter(assignee__username=value)

    class Meta:
        model = PerformanceAlertSummary
        fields = [
            'id',
            'status',
            'framework',
            'repository',
            'alerts__series_signature',
            'filter_text',
            'hide_improvements',
            'hide_related_and_invalid',
            'with_assignee',
        ]


class PerformanceAlertSummaryViewSet(viewsets.ModelViewSet):
    """ViewSet for the performance alert summary model"""

    queryset = (
        PerformanceAlertSummary.objects.filter(repository__active_status='active')
        .select_related('repository', 'push')
        .prefetch_related(
            'alerts',
            'alerts__classifier',
            'alerts__series_signature',
            'alerts__series_signature__platform',
            'alerts__series_signature__option_collection',
            'alerts__series_signature__option_collection__option',
        )
    )
    permission_classes = (IsStaffOrReadOnly,)

    serializer_class = PerformanceAlertSummarySerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filterset_class = PerformanceAlertSummaryFilter

    ordering = ('-created', '-id')
    pagination_class = AlertSummaryPagination

    def create(self, request, *args, **kwargs):
        data = request.data

        alert_summary, _ = PerformanceAlertSummary.objects.get_or_create(
            repository_id=data['repository_id'],
            framework=PerformanceFramework.objects.get(id=data['framework_id']),
            push_id=data['push_id'],
            prev_push_id=data['prev_push_id'],
            defaults={'manually_created': True, 'created': datetime.datetime.now()},
        )

        return Response({"alert_summary_id": alert_summary.id})


class PerformanceAlertViewSet(viewsets.ModelViewSet):
    queryset = PerformanceAlert.objects.all()
    permission_classes = (IsStaffOrReadOnly,)

    serializer_class = PerformanceAlertSerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ['id']
    ordering = '-id'

    class AlertPagination(pagination.CursorPagination):
        ordering = '-id'
        page_size = 10

    pagination_class = AlertPagination

    def update(self, request, *args, **kwargs):
        new_push_id = request.data.get('push_id')
        new_prev_push_id = request.data.get('prev_push_id')

        if new_push_id is None and new_prev_push_id is None:
            request.data['classifier'] = request.user.username
            return super().update(request, *args, **kwargs)
        else:
            alert = PerformanceAlert.objects.get(pk=kwargs['pk'])
            if all([new_push_id, new_prev_push_id]) and alert.summary.push.id != new_push_id:
                return self.nudge(alert, new_push_id, new_prev_push_id)

            return Response({"message": "Incorrect push was provided"}, status=HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        data = request.data
        if 'summary_id' not in data or 'signature_id' not in data:
            return Response(
                {"message": "Summary and signature ids necessary " "to create alert"},
                status=HTTP_400_BAD_REQUEST,
            )

        summary = PerformanceAlertSummary.objects.get(id=data['summary_id'])
        signature = PerformanceSignature.objects.get(id=data['signature_id'])

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
                't_value': 1000,
            },
        )
        alert.timestamp_first_triage().save()

        return Response({"alert_id": alert.id})

    def calculate_alert_properties(self, alert_summary, series_signature):
        prev_range = series_signature.max_back_window
        if not prev_range:
            prev_range = settings.PERFHERDER_ALERTS_MAX_BACK_WINDOW
        new_range = series_signature.fore_window
        if not new_range:
            new_range = settings.PERFHERDER_ALERTS_FORE_WINDOW

        prev_data = PerformanceDatum.objects.filter(
            signature=series_signature, push_timestamp__lte=alert_summary.prev_push.time
        ).order_by('-push_timestamp')
        prev_values = prev_data.values_list('value', flat=True)[:prev_range]

        new_data = PerformanceDatum.objects.filter(
            signature=series_signature, push_timestamp__gt=alert_summary.prev_push.time
        ).order_by('push_timestamp')
        new_values = new_data.values_list('value', flat=True)[:new_range]

        if not prev_data or not new_data:
            raise InsufficientAlertCreationData

        prev_value = sum(prev_values) / len(prev_values)
        new_value = sum(new_values) / len(new_values)

        return get_alert_properties(prev_value, new_value, series_signature.lower_is_better)

    @transaction.atomic
    def nudge(self, alert, new_push_id, new_prev_push_id):
        # Bug 1532230 disabled nudging because it broke links
        # Bug 1532283 will re enable a better version of it
        raise exceptions.APIException('Nudging has been disabled', 400)


class PerformanceBugTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PerformanceBugTemplate.objects.all()
    serializer_class = PerformanceBugTemplateSerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ['framework']


class PerformanceIssueTrackerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IssueTracker.objects.all()
    serializer_class = IssueTrackerSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = 'id'


class PerformanceSummary(generics.ListAPIView):
    serializer_class = PerformanceSummarySerializer
    queryset = None

    def list(self, request):
        query_params = PerformanceQueryParamsSerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        startday = query_params.validated_data['startday']
        endday = query_params.validated_data['endday']
        revision = query_params.validated_data['revision']
        repository_name = query_params.validated_data['repository']
        interval = query_params.validated_data['interval']
        frameworks = query_params.validated_data['framework']
        parent_signature = query_params.validated_data['parent_signature']
        signature = query_params.validated_data['signature']
        no_subtests = query_params.validated_data['no_subtests']
        all_data = query_params.validated_data['all_data']

        signature_data = PerformanceSignature.objects.select_related(
            'framework', 'repository', 'platform', 'push', 'job'
        ).filter(repository__name=repository_name)

        # TODO deprecate signature hash support
        if signature and len(signature) == 40:
            signature_data = signature_data.filter(signature_hash=signature)
        elif signature:
            signature_data = signature_data.filter(id=signature)
        else:
            signature_data = signature_data.filter(parent_signature__isnull=no_subtests)

        if frameworks:
            signature_data = signature_data.filter(framework__in=frameworks)

        if parent_signature:
            signature_data = signature_data.filter(parent_signature_id=parent_signature)

        # we do this so all relevant signature data is returned even if there isn't performance data
        # and it's also not needed since this param is used to filter directly on signature_id
        if interval and not all_data:
            signature_data = signature_data.filter(
                last_updated__gte=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))
                )
            )

        # TODO signature_hash is being returned for legacy support - should be removed at some point
        self.queryset = signature_data.values(
            'framework_id',
            'id',
            'lower_is_better',
            'has_subtests',
            'extra_options',
            'suite',
            'signature_hash',
            'platform__platform',
            'test',
            'option_collection_id',
            'parent_signature_id',
            'repository_id',
            'tags',
            'measurement_unit',
            'application',
        )

        signature_ids = [item['id'] for item in list(self.queryset)]

        data = PerformanceDatum.objects.select_related('push', 'repository', 'id').filter(
            signature_id__in=signature_ids, repository__name=repository_name
        )

        if revision:
            data = data.filter(push__revision=revision)
        elif interval and not startday and not endday:
            data = data.filter(
                push_timestamp__gt=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))
                )
            )
        else:
            data = data.filter(push_timestamp__gt=startday, push_timestamp__lt=endday)

        # more efficient than creating a join on option_collection and option
        option_collection = OptionCollection.objects.select_related('option').values(
            'id', 'option__name'
        )
        option_collection_map = {
            item['id']: item['option__name'] for item in list(option_collection)
        }

        if signature and all_data:
            for item in self.queryset:
                item['data'] = data.values(
                    'value', 'job_id', 'id', 'push_id', 'push_timestamp', 'push__revision'
                ).order_by('push_timestamp')
                item['option_name'] = option_collection_map[item['option_collection_id']]
                item['repository_name'] = repository_name

        else:
            grouped_values = defaultdict(list)
            grouped_job_ids = defaultdict(list)
            for signature_id, value, job_id in data.values_list('signature_id', 'value', 'job_id'):
                if value is not None:
                    grouped_values[signature_id].append(value)
                    grouped_job_ids[signature_id].append(job_id)

            # name field is created in the serializer
            for item in self.queryset:
                item['values'] = grouped_values.get(item['id'], [])
                item['job_ids'] = grouped_job_ids.get(item['id'], [])
                item['option_name'] = option_collection_map[item['option_collection_id']]
                item['repository_name'] = repository_name

        serializer = self.get_serializer(self.queryset, many=True)
        return Response(data=serializer.data)


class TestSuiteHealthViewSet(viewsets.ViewSet):
    def list(self, request):
        query_params = TestSuiteHealthParamsSerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        framework_id = query_params.validated_data['framework']
        query_set = (
            PerformanceSignature.objects.prefetch_related('performancealert')
            .filter(framework_id=framework_id, parent_signature_id=None)
            .values('suite', 'test')
            .annotate(repositories=GroupConcat('repository_id', distinct=True))
            .annotate(platforms=GroupConcat('platform_id', distinct=True))
            .annotate(total_alerts=Count('performancealert'))
            .order_by('suite', 'test')
        )

        serializer = TestSuiteHealthSerializer(query_set, many=True)
        return Response(data=serializer.data)
