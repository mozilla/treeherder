import datetime
import time
from collections import defaultdict
from urllib.parse import urlencode

import django_filters
import numpy as np
from cliffs_delta import cliffs_delta
from django.conf import settings
from django.db import transaction
from django.db.models import Case, CharField, Count, Q, Subquery, Value, When
from django.db.models.functions import Concat
from rest_framework import exceptions, filters, generics, pagination, viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.etl.common import to_timestamp
from treeherder.model import models
from treeherder.perf import stats
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
    PerformanceTag,
)
from treeherder.webapp.api import perfcompare_utils
from treeherder.webapp.api.performance_serializers import OptionalBooleanField
from treeherder.webapp.api.permissions import IsStaffOrReadOnly

from .exceptions import InsufficientAlertCreationData
from .performance_serializers import (
    IssueTrackerSerializer,
    PerfAlertSummaryTasksQueryParamSerializer,
    PerfCompareResultsQueryParamsSerializer,
    PerfCompareResultsSerializer,
    PerfCompareResultsSerializerV2,
    PerformanceAlertSerializer,
    PerformanceAlertSummarySerializer,
    PerformanceAlertSummaryTasksSerializer,
    PerformanceBugTemplateSerializer,
    PerformanceFrameworkSerializer,
    PerformanceQueryParamsSerializer,
    PerformanceSummarySerializer,
    PerformanceTagSerializer,
    TestSuiteHealthParamsSerializer,
    TestSuiteHealthSerializer,
)
from .utils import SHERIFFED_FRAMEWORKS, GroupConcat, get_profile_artifact_url


class PerformanceSignatureViewSet(viewsets.ViewSet):
    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)

        signature_data = PerformanceSignature.objects.filter(repository=repository).select_related(
            "parent_signature__signature_hash", "option_collection", "platform"
        )

        parent_signature_hashes = request.query_params.getlist("parent_signature")
        if parent_signature_hashes:
            parent_signatures = PerformanceSignature.objects.filter(
                repository=repository, signature_hash__in=parent_signature_hashes
            )
            signature_data = signature_data.filter(parent_signature__in=parent_signatures)

        if not int(request.query_params.get("subtests", True)):
            signature_data = signature_data.filter(parent_signature__isnull=True)

        signature_ids = request.query_params.getlist("id")
        if signature_ids:
            try:
                signature_data = signature_data.filter(id__in=map(int, signature_ids))
            except ValueError:
                return Response(
                    {"message": "One or more id values invalid (must be integer)"},
                    status=HTTP_400_BAD_REQUEST,
                )

        signature_hashes = request.query_params.getlist("signature")
        if signature_hashes:
            signature_data = signature_data.filter(signature_hash__in=signature_hashes)

        frameworks = request.query_params.getlist("framework")
        if frameworks:
            signature_data = signature_data.filter(framework__in=frameworks)

        interval = request.query_params.get("interval")
        start_date = request.query_params.get("start_date")  # YYYY-MM-DDTHH:MM:SS
        end_date = request.query_params.get("end_date")  # YYYY-MM-DDTHH:MM:SS
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

        platform = request.query_params.get("platform")
        if platform:
            platforms = models.MachinePlatform.objects.filter(platform=platform)
            signature_data = signature_data.filter(platform__in=platforms)

        signature_map = {}
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
            should_alert,
        ) in signature_data.values_list(
            "id",
            "signature_hash",
            "option_collection__option_collection_hash",
            "platform__platform",
            "framework",
            "suite",
            "test",
            "application",
            "lower_is_better",
            "extra_options",
            "measurement_unit",
            "has_subtests",
            "tags",
            "parent_signature__signature_hash",
            "should_alert",
        ).distinct():
            signature_map[id] = signature_props = {
                "id": id,
                "signature_hash": signature_hash,
                "framework_id": framework,
                "option_collection_hash": option_collection_hash,
                "machine_platform": platform,
                "suite": suite,
                "should_alert": should_alert,
            }
            if not lower_is_better:
                # almost always true, save some bandwidth by assuming that by
                # default
                signature_props["lower_is_better"] = False
            if test:
                # test may be empty in case of a summary test, leave it empty
                # then
                signature_props["test"] = test
            if application:
                signature_props["application"] = application
            if has_subtests:
                signature_props["has_subtests"] = True
            if tags:
                # tags stored as charField but api returns as list
                signature_props["tags"] = tags.split(" ")
            if parent_signature_hash:
                # this value is often null, save some bandwidth by excluding
                # it if not present
                signature_props["parent_signature"] = parent_signature_hash

            if extra_options:
                # extra_options stored as charField but api returns as list
                signature_props["extra_options"] = extra_options.split(" ")
            if measurement_unit:
                signature_props["measurement_unit"] = measurement_unit

        return Response(signature_map)


class PerformancePlatformViewSet(viewsets.ViewSet):
    """
    All platforms for a particular branch that have performance data
    """

    def list(self, request, project):
        signature_data = PerformanceSignature.objects.filter(repository__name=project)
        interval = request.query_params.get("interval")
        if interval:
            signature_data = signature_data.filter(
                last_updated__gte=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))
                )
            )

        frameworks = request.query_params.getlist("framework")
        if frameworks:
            signature_data = signature_data.filter(framework__in=frameworks)

        return Response(signature_data.values_list("platform__platform", flat=True).distinct())


class PerformanceFrameworkViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PerformanceFramework.objects.filter(enabled=True)
    serializer_class = PerformanceFrameworkSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = "id"


class PerformanceDatumViewSet(viewsets.ViewSet):
    """
    This view serves performance test result data
    """

    def list(self, request, project):
        repository = models.Repository.objects.get(name=project)

        signature_hashes = request.query_params.getlist("signatures")  # deprecated
        signature_ids = request.query_params.getlist("signature_id")
        push_ids = request.query_params.getlist("push_id")
        no_retriggers = request.query_params.get("no_retriggers", False)
        no_retriggers = OptionalBooleanField().to_internal_value(no_retriggers)

        try:
            job_ids = [int(job_id) for job_id in request.query_params.getlist("job_id")]
        except ValueError:
            return Response(
                {"message": "Job id(s) must be specified as integers"}, status=HTTP_400_BAD_REQUEST
            )

        if not (signature_ids or signature_hashes or push_ids or job_ids):
            raise exceptions.ValidationError(
                "Need to specify either signature_id, signatures, push_id, or job_id"
            )
        if signature_ids and signature_hashes:
            raise exceptions.ValidationError(
                "Can't specify both signature_id and signatures in same query"
            )

        datums = PerformanceDatum.objects.filter(repository=repository).select_related(
            "signature", "push"
        )

        if signature_hashes:
            signature_ids = PerformanceSignature.objects.filter(
                repository=repository, signature_hash__in=signature_hashes
            ).values_list("id", flat=True)

            datums = datums.filter(signature__id__in=list(signature_ids))
        elif signature_ids:
            datums = datums.filter(signature__id__in=list(signature_ids))
        if push_ids:
            datums = datums.filter(push_id__in=push_ids)
        if job_ids:
            datums = datums.filter(job_id__in=job_ids)

        frameworks = request.query_params.getlist("framework")
        if frameworks:
            datums = datums.filter(signature__framework__in=frameworks)

        interval = request.query_params.get("interval")
        start_date = request.query_params.get("start_date")  # 'YYYY-MM-DDTHH:MM:SS
        end_date = request.query_params.get("end_date")  # 'YYYY-MM-DDTHH:MM:SS'
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

        ret, seen_push_ids = defaultdict(list), defaultdict(set)
        values_list = datums.values_list(
            "id",
            "signature_id",
            "signature__signature_hash",
            "job_id",
            "push_id",
            "push_timestamp",
            "value",
            "push__revision",
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
            should_include_datum = True
            if no_retriggers:
                if push_id in seen_push_ids[signature_hash]:
                    should_include_datum = False
                else:
                    seen_push_ids[signature_hash].add(push_id)

            if should_include_datum:
                ret[signature_hash].append(
                    {
                        "id": id,
                        "signature_id": signature_id,
                        "job_id": job_id,
                        "push_id": push_id,
                        "revision": push__revision,
                        "push_timestamp": int(time.mktime(push_timestamp.timetuple())),
                        "value": round(value, 2),  # round to 2 decimal places
                    }
                )

        return Response(ret)


class AlertSummaryPagination(pagination.PageNumberPagination):
    ordering = ("-created", "-id")
    page_size_query_param = "limit"
    max_page_size = 100
    page_size = 10


class PerformanceAlertSummaryFilter(django_filters.FilterSet):
    id = django_filters.NumberFilter(field_name="id")
    status = django_filters.NumberFilter(field_name="status")
    framework = django_filters.NumberFilter(field_name="framework")
    repository = django_filters.NumberFilter(field_name="repository")
    alerts__series_signature = django_filters.NumberFilter(field_name="alerts__series_signature")
    filter_text = django_filters.CharFilter(method="_filter_text")
    hide_improvements = django_filters.BooleanFilter(method="_hide_improvements")
    hide_related_and_invalid = django_filters.BooleanFilter(method="_hide_related_and_invalid")
    with_assignee = django_filters.CharFilter(method="_with_assignee")
    timerange = django_filters.NumberFilter(method="_timerange")
    show_sheriffed_frameworks = django_filters.BooleanFilter(method="_show_sheriffed_frameworks")

    def _filter_text(self, queryset, name, value):
        sep = Value(" ")
        words = value.split(" ")

        contains_all_words = [
            Q(full_name__contains=word) | Q(related_full_name__contains=word) for word in words
        ]

        # Django's distinct(*fields) isn't supported for MySQL
        # https://code.djangoproject.com/ticket/17974
        filtered_summaries = (
            queryset.annotate(
                full_name=Concat(
                    "alerts__series_signature__suite",
                    sep,
                    "alerts__series_signature__test",
                    sep,
                    "alerts__series_signature__platform__platform",
                    sep,
                    "alerts__series_signature__extra_options",
                    sep,
                    "bug_number",
                    sep,
                    "push__revision",
                    output_field=CharField(),
                ),
                related_full_name=Concat(
                    "related_alerts__series_signature__suite",
                    sep,
                    "related_alerts__series_signature__test",
                    sep,
                    "related_alerts__series_signature__platform__platform",
                    sep,
                    "related_alerts__series_signature__extra_options",
                    sep,
                    "bug_number",
                    sep,
                    "push__revision",
                    output_field=CharField(),
                ),
            )
            .filter(*contains_all_words)
            .values("id")
            .distinct()
        )

        return queryset.filter(id__in=Subquery(filtered_summaries))

    def _hide_improvements(self, queryset, name, value):
        return queryset.annotate(total_regressions=Count("alerts__is_regression")).filter(
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

    def _timerange(self, queryset, name, value):
        return queryset.filter(
            push__time__gt=datetime.datetime.utcfromtimestamp(int(time.time() - int(value)))
        )

    def _show_sheriffed_frameworks(self, queryset, name, value):
        return queryset.filter(framework__name__in=SHERIFFED_FRAMEWORKS)

    class Meta:
        model = PerformanceAlertSummary
        fields = [
            "id",
            "status",
            "framework",
            "repository",
            "alerts__series_signature",
            "filter_text",
            "hide_improvements",
            "hide_related_and_invalid",
            "with_assignee",
            "timerange",
        ]


class PerformanceTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PerformanceTag.objects.all()
    serializer_class = PerformanceTagSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = "id"


class PerformanceAlertSummaryViewSet(viewsets.ModelViewSet):
    """ViewSet for the performance alert summary model"""

    queryset = (
        PerformanceAlertSummary.objects.filter(repository__active_status="active")
        .select_related("repository", "push")
        .prefetch_related(
            "alerts",
            "alerts__classifier",
            "alerts__series_signature",
            "alerts__series_signature__platform",
            "alerts__series_signature__option_collection",
            "alerts__series_signature__option_collection__option",
            "related_alerts",
            "related_alerts__classifier",
            "related_alerts__series_signature",
            "related_alerts__series_signature__platform",
            "related_alerts__series_signature__option_collection",
            "related_alerts__series_signature__option_collection__option",
            "performance_tags",
        )
    )
    permission_classes = (IsStaffOrReadOnly,)

    serializer_class = PerformanceAlertSummarySerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filterset_class = PerformanceAlertSummaryFilter

    ordering = ("-created", "-id")
    pagination_class = AlertSummaryPagination

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.queryset)
        pk = request.query_params.get("id")
        if not pk:
            if request.query_params.get("monitored_alerts"):
                queryset = queryset.filter(sheriffed=False)
            else:
                queryset = queryset.filter(sheriffed=True)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            if pk:
                for summary in serializer.data:
                    if summary["id"] == int(pk):
                        for alert in summary["alerts"]:
                            if alert["is_regression"]:
                                alert["profile_url"] = get_profile_artifact_url(
                                    alert, metadata_key="taskcluster_metadata"
                                )
                                alert["prev_profile_url"] = get_profile_artifact_url(
                                    alert, metadata_key="prev_taskcluster_metadata"
                                )
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(many=True, data=queryset)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        data = request.data

        if data["push_id"] == data["prev_push_id"]:
            return Response(
                "IDs of push & previous push cannot be identical", status=HTTP_400_BAD_REQUEST
            )

        alert_summary, _ = PerformanceAlertSummary.objects.get_or_create(
            repository_id=data["repository_id"],
            framework=PerformanceFramework.objects.get(id=data["framework_id"]),
            push_id=data["push_id"],
            prev_push_id=data["prev_push_id"],
            defaults={"manually_created": True, "created": datetime.datetime.now()},
        )

        return Response({"alert_summary_id": alert_summary.id})

    def update(self, request, *args, **kwargs):
        """
        PUT method custom implementation, which allows the status to update itself.
        """
        instance = self.get_object()
        instance.update_status()  # updating the PerformanceAlertSummary's status
        return super().update(request, *args, **kwargs)


class PerformanceAlertViewSet(viewsets.ModelViewSet):
    queryset = PerformanceAlert.objects.all()
    permission_classes = (IsStaffOrReadOnly,)

    serializer_class = PerformanceAlertSerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ["id"]
    ordering = "-id"

    class AlertPagination(pagination.CursorPagination):
        ordering = "-id"
        page_size = 10

    pagination_class = AlertPagination

    def update(self, request, *args, **kwargs):
        new_push_id = request.data.get("push_id")
        new_prev_push_id = request.data.get("prev_push_id")

        if new_push_id is None and new_prev_push_id is None:
            request.data["classifier"] = request.user.username
            return super().update(request, *args, **kwargs)
        else:
            alert = PerformanceAlert.objects.get(pk=kwargs["pk"])
            if all([new_push_id, new_prev_push_id]) and alert.summary.push.id != new_push_id:
                return self.nudge(alert, new_push_id, new_prev_push_id)

            return Response({"message": "Incorrect push was provided"}, status=HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        data = request.data
        if "summary_id" not in data or "signature_id" not in data:
            return Response(
                {"message": "Summary and signature ids necessary to create alert"},
                status=HTTP_400_BAD_REQUEST,
            )

        summary = PerformanceAlertSummary.objects.get(id=data["summary_id"])
        signature = PerformanceSignature.objects.get(id=data["signature_id"])

        alert_properties = self.calculate_alert_properties(summary, signature)

        alert, _ = PerformanceAlert.objects.get_or_create(
            summary=summary,
            series_signature=signature,
            defaults={
                "is_regression": alert_properties.is_regression,
                "manually_created": True,
                "amount_pct": alert_properties.pct_change,
                "amount_abs": alert_properties.delta,
                "prev_value": alert_properties.prev_value,
                "new_value": alert_properties.new_value,
                "t_value": 1000,
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
        ).order_by("-push_timestamp")
        prev_values = prev_data.values_list("value", flat=True)[:prev_range]

        new_data = PerformanceDatum.objects.filter(
            signature=series_signature, push_timestamp__gt=alert_summary.prev_push.time
        ).order_by("push_timestamp")
        new_values = new_data.values_list("value", flat=True)[:new_range]

        if not prev_data or not new_data:
            raise InsufficientAlertCreationData

        prev_value = sum(prev_values) / len(prev_values)
        new_value = sum(new_values) / len(new_values)

        return get_alert_properties(prev_value, new_value, series_signature.lower_is_better)

    @transaction.atomic
    def nudge(self, alert, new_push_id, new_prev_push_id):
        # Bug 1532230 disabled nudging because it broke links
        # Bug 1532283 will re enable a better version of it
        raise exceptions.APIException("Nudging has been disabled", 400)


class PerformanceBugTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PerformanceBugTemplate.objects.all()
    serializer_class = PerformanceBugTemplateSerializer
    filter_backends = (django_filters.rest_framework.DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ["framework"]


class PerformanceIssueTrackerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IssueTracker.objects.all()
    serializer_class = IssueTrackerSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = "id"


class PerformanceSummary(generics.ListAPIView):
    serializer_class = PerformanceSummarySerializer
    queryset = None

    def list(self, request):
        query_params = PerformanceQueryParamsSerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        startday = query_params.validated_data["startday"]
        endday = query_params.validated_data["endday"]
        revision = query_params.validated_data["revision"]
        repository_name = query_params.validated_data["repository"]
        interval = query_params.validated_data["interval"]
        frameworks = query_params.validated_data["framework"]
        parent_signature = query_params.validated_data["parent_signature"]
        signature = query_params.validated_data["signature"]
        no_subtests = query_params.validated_data["no_subtests"]
        all_data = query_params.validated_data["all_data"]
        no_retriggers = query_params.validated_data["no_retriggers"]
        replicates = query_params.validated_data["replicates"]

        signature_data = PerformanceSignature.objects.select_related(
            "framework", "repository", "platform", "push", "job"
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
            "framework_id",
            "id",
            "lower_is_better",
            "has_subtests",
            "extra_options",
            "suite",
            "signature_hash",
            "platform__platform",
            "test",
            "option_collection_id",
            "parent_signature_id",
            "repository_id",
            "tags",
            "measurement_unit",
            "application",
            "should_alert",
            "alert_change_type",
            "alert_threshold",
            "parent_signature__should_alert",
        )

        self.check_and_update_should_alert()

        signature_ids = [item["id"] for item in list(self.queryset)]

        data = (
            PerformanceDatum.objects.select_related("push", "repository", "job")
            .filter(signature_id__in=signature_ids, repository__name=repository_name)
            .order_by("job_id", "id")
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
        option_collection = OptionCollection.objects.select_related("option").values(
            "id", "option__name"
        )
        option_collection_map = {
            item["id"]: item["option__name"] for item in list(option_collection)
        }

        if signature and all_data:
            for item in self.queryset:
                if replicates:
                    item["data"] = list()
                    for (
                        value,
                        job_id,
                        datum_id,
                        push_id,
                        push_timestamp,
                        push_revision,
                        replicate_value,
                        submit_time,
                    ) in data.values_list(
                        "value",
                        "job_id",
                        "id",
                        "push_id",
                        "push_timestamp",
                        "push__revision",
                        "performancedatumreplicate__value",
                        "job__submit_time",
                    ).order_by("push_timestamp", "push_id", "job_id"):
                        if replicate_value is not None:
                            item["data"].append(
                                {
                                    "value": replicate_value,
                                    "job_id": job_id,
                                    "id": datum_id,
                                    "push_id": push_id,
                                    "push_timestamp": push_timestamp,
                                    "push__revision": push_revision,
                                    "submit_time": submit_time,
                                }
                            )
                        elif value is not None:
                            item["data"].append(
                                {
                                    "value": value,
                                    "job_id": job_id,
                                    "id": datum_id,
                                    "push_id": push_id,
                                    "push_timestamp": push_timestamp,
                                    "push__revision": push_revision,
                                    "submit_time": submit_time,
                                }
                            )
                else:
                    item["data"] = data.values(
                        "value",
                        "job_id",
                        "id",
                        "push_id",
                        "push_timestamp",
                        "push__revision",
                        "job__submit_time",
                    ).order_by("push_timestamp", "push_id", "job_id")

                item["option_name"] = option_collection_map[item["option_collection_id"]]
                item["repository_name"] = repository_name

        else:
            grouped_values = defaultdict(list)
            grouped_job_ids = defaultdict(list)
            grouped_submit_times = defaultdict(list)
            if replicates:
                for signature_id, value, job_id, replicate_value, submit_time in data.values_list(
                    "signature_id",
                    "value",
                    "job_id",
                    "performancedatumreplicate__value",
                    "job__submit_time",
                ):
                    if replicate_value is not None:
                        grouped_values[signature_id].append(replicate_value)
                        grouped_job_ids[signature_id].append(job_id)
                        grouped_submit_times[signature_id].append(submit_time)
                    elif value is not None:
                        grouped_values[signature_id].append(value)
                        grouped_job_ids[signature_id].append(job_id)
                        grouped_submit_times[signature_id].append(submit_time)
            else:
                for signature_id, value, job_id, submit_time in data.values_list(
                    "signature_id", "value", "job_id", "job__submit_time"
                ):
                    if value is not None:
                        grouped_values[signature_id].append(value)
                        grouped_job_ids[signature_id].append(job_id)
                        grouped_submit_times[signature_id].append(submit_time)

            # name field is created in the serializer
            for item in self.queryset:
                item["values"] = grouped_values.get(item["id"], [])
                item["job_ids"] = grouped_job_ids.get(item["id"], [])
                item["submit_times"] = grouped_submit_times.get(item["id"], [])
                item["option_name"] = option_collection_map[item["option_collection_id"]]
                item["repository_name"] = repository_name

        serializer = self.get_serializer(self.queryset, many=True)
        serialized_data = serializer.data

        if no_retriggers:
            serialized_data = self._filter_out_retriggers(serialized_data)

        return Response(data=serialized_data)

    def check_and_update_should_alert(self):
        """
        If a suite has a `should_alert` value of either null or True and there is a suite-level value set,
        but the subtests do not have the `should_alert` set to True, then those subtests will not trigger an alert.
        A null value for these subtests indicates that the `should_alert` parameter is set to False.
        """
        for signature in list(self.queryset):
            if (
                signature["should_alert"] is None
                and signature["parent_signature_id"] is not None
                and signature["parent_signature__should_alert"] is not False
                and PerformanceDatum.objects.filter(
                    signature_id=signature["parent_signature_id"], value__isnull=False
                ).exists()
            ):
                signature["should_alert"] = False

    @staticmethod
    def _filter_out_retriggers(serialized_data):
        """
        Removes data points resulted from retriggers
        """

        for perf_summary in serialized_data:
            retriggered_jobs, seen_push_id = set(), None
            for idx, datum in enumerate(perf_summary["data"]):
                if seen_push_id == datum["push_id"]:
                    retriggered_jobs.add(idx)
                else:
                    seen_push_id = datum["push_id"]

            if retriggered_jobs:
                perf_summary["data"] = [
                    datum
                    for idx, datum in enumerate(perf_summary["data"])
                    if idx not in retriggered_jobs
                ]

        return serialized_data


class PerformanceAlertSummaryTasks(generics.ListAPIView):
    serializer_class = PerformanceAlertSummaryTasksSerializer
    queryset = None

    def list(self, request):
        query_params = PerfAlertSummaryTasksQueryParamSerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        alert_summary_id = query_params.validated_data["id"]
        signature_ids = PerformanceAlertSummary.objects.filter(id=alert_summary_id).values_list(
            "alerts__series_signature__id", "related_alerts__series_signature__id"
        )
        signature_ids = [id for id_set in signature_ids for id in id_set]
        tasks = (
            PerformanceDatum.objects.filter(signature__in=signature_ids)
            .values_list("job__job_type__name", flat=True)
            .order_by("job__job_type__name")
            .distinct()
        )
        self.queryset = {"id": alert_summary_id, "tasks": tasks}
        serializer = self.get_serializer(self.queryset)

        return Response(data=serializer.data)


class PerfCompareResults(generics.ListAPIView):
    serializer_class = PerfCompareResultsSerializer
    queryset = None

    def get_serializer_class(self):
        test_version = self.request.query_params.get("test_version", "")
        if test_version == "student-t":
            return PerfCompareResultsSerializer
        if test_version == "mann-whitney-u":
            return PerfCompareResultsSerializerV2
        else:
            return PerfCompareResultsSerializer

    def list(self, request):
        query_params = PerfCompareResultsQueryParamsSerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        base_rev = query_params.validated_data["base_revision"]
        new_rev = query_params.validated_data["new_revision"]
        base_repo_name = query_params.validated_data["base_repository"]
        new_repo_name = query_params.validated_data["new_repository"]
        interval = query_params.validated_data["interval"]
        framework = query_params.validated_data["framework"]
        no_subtests = query_params.validated_data["no_subtests"]
        base_parent_signature = query_params.validated_data["base_parent_signature"]
        new_parent_signature = query_params.validated_data["new_parent_signature"]
        replicates = query_params.validated_data["replicates"]
        test_version = query_params.validated_data["test_version"]

        try:
            new_push = models.Push.objects.get(revision=new_rev, repository__name=new_repo_name)
        except models.Push.DoesNotExist:
            return Response(
                f"No new push with revision {new_rev} from repo {new_repo_name}.",
                status=HTTP_400_BAD_REQUEST,
            )

        try:
            base_push, start_day, end_day = None, None, None
            if base_rev:
                base_push = models.Push.objects.get(
                    revision=base_rev, repository__name=base_repo_name
                )
                # Dynamically calculate a time interval based on the base and new push
                interval = self._get_interval(base_push, new_push)
            else:
                # Comparing without a base needs a timerange from which to gather the data needed
                # based on the interval param received, which can be last day or last 2/ 7/ 14 /30 /90 days or last year
                start_day = datetime.datetime.utcfromtimestamp(
                    int(to_timestamp(str(new_push.time)) - int(interval))
                )
                end_day = new_push.time
        except models.Push.DoesNotExist:
            return Response(
                f"No base push with revision {base_rev} from repo {base_repo_name}.",
                status=HTTP_400_BAD_REQUEST,
            )

        push_timestamp = self._get_push_timestamp(base_push, new_push)

        base_signatures = self._get_signatures(
            base_repo_name, framework, base_parent_signature, interval, no_subtests
        )

        new_signatures = self._get_signatures(
            new_repo_name, framework, new_parent_signature, interval, no_subtests
        )

        base_perf_data = self._get_perf_data(
            base_repo_name, base_rev, base_signatures, interval, start_day, end_day
        )
        new_perf_data = self._get_perf_data(
            new_repo_name, new_rev, new_signatures, interval, None, None
        )

        option_collection_map = perfcompare_utils.get_option_collection_map()

        (
            base_grouped_job_ids,
            base_grouped_values,
            base_grouped_replicates,
        ) = self._get_grouped_perf_data(base_perf_data)
        (
            new_grouped_job_ids,
            new_grouped_values,
            new_grouped_replicates,
        ) = self._get_grouped_perf_data(new_perf_data)

        statistics_base_grouped_data = base_grouped_values
        statistics_new_grouped_data = new_grouped_values
        if replicates:
            statistics_base_grouped_data = base_grouped_replicates
            statistics_new_grouped_data = new_grouped_replicates

        base_signatures_map, base_header_names, base_platforms = self._get_signatures_map(
            base_signatures, statistics_base_grouped_data, option_collection_map
        )
        new_signatures_map, new_header_names, new_platforms = self._get_signatures_map(
            new_signatures, statistics_new_grouped_data, option_collection_map
        )

        header_names = list(set(base_header_names + new_header_names))
        header_names.sort()
        platforms = set(base_platforms + new_platforms)
        self.queryset = []

        for header in header_names:
            for platform in platforms:
                sig_identifier = perfcompare_utils.get_sig_identifier(header, platform)
                base_sig = base_signatures_map.get(sig_identifier, {})
                base_sig_id = base_sig.get("id", None)
                new_sig = new_signatures_map.get(sig_identifier, {})
                new_sig_id = new_sig.get("id", None)
                if base_sig:
                    (
                        extra_options,
                        lower_is_better,
                        option_name,
                        sig_hash,
                        suite,
                        test,
                    ) = self._get_signature_based_properties(base_sig, option_collection_map)
                else:
                    (
                        extra_options,
                        lower_is_better,
                        option_name,
                        sig_hash,
                        suite,
                        test,
                    ) = self._get_signature_based_properties(new_sig, option_collection_map)
                base_perf_data_values = base_grouped_values.get(base_sig_id, [])
                new_perf_data_values = new_grouped_values.get(new_sig_id, [])
                base_perf_data_replicates = base_grouped_replicates.get(base_sig_id, [])
                new_perf_data_replicates = new_grouped_replicates.get(new_sig_id, [])
                statistics_base_perf_data = statistics_base_grouped_data.get(base_sig_id, [])
                statistics_new_perf_data = statistics_new_grouped_data.get(new_sig_id, [])
                base_runs_count = len(statistics_base_perf_data)
                new_runs_count = len(statistics_new_perf_data)
                is_complete = base_runs_count and new_runs_count
                no_results_to_show = not base_runs_count and not new_runs_count
                common_result = {
                    "base_rev": base_rev,
                    "new_rev": new_rev,
                    "header_name": header,
                    "platform": platform,
                    "base_app": base_sig.get("application", ""),
                    "new_app": new_sig.get("application", ""),
                    "suite": suite,  # same suite for base_result and new_result
                    "test": test,  # same test for base_result and new_result
                    "is_complete": is_complete,
                    "framework_id": framework,
                    "option_name": option_name,
                    "extra_options": extra_options,
                    "base_repository_name": base_repo_name,
                    "new_repository_name": new_repo_name,
                    "base_measurement_unit": base_sig.get("measurement_unit", ""),
                    "new_measurement_unit": new_sig.get("measurement_unit", ""),
                    "base_runs": sorted(base_perf_data_values),
                    "new_runs": sorted(new_perf_data_values),
                    "base_runs_replicates": sorted(base_perf_data_replicates),
                    "new_runs_replicates": sorted(new_perf_data_replicates),
                    # highlighted revisions is the base_revision and the other highlighted revisions is new_revision
                    "graphs_link": self._create_graph_links(
                        base_repo_name,
                        new_repo_name,
                        base_rev,
                        new_rev,
                        str(framework),
                        push_timestamp,
                        str(sig_hash),
                    ),
                    "base_retriggerable_job_ids": base_grouped_job_ids.get(base_sig_id, []),
                    "new_retriggerable_job_ids": new_grouped_job_ids.get(new_sig_id, []),
                    "base_parent_signature": base_sig.get("parent_signature_id", None),
                    "new_parent_signature": new_sig.get("parent_signature_id", None),
                    "base_signature_id": base_sig_id,
                    "new_signature_id": new_sig_id,
                    "has_subtests": (
                        base_sig.get("has_subtests", None) or new_sig.get("has_subtests", None)
                    ),
                }
                if no_results_to_show:
                    continue
                if test_version == "mann-whitney-u":
                    new_stats = self._process_stats(
                        statistics_base_perf_data, statistics_new_perf_data, header, lower_is_better
                    )

                    row_result = {
                        **common_result,
                        **new_stats,
                    }
                    self.queryset.append(row_result)
                else:
                    base_avg_value = perfcompare_utils.get_avg(statistics_base_perf_data, header)
                    base_stddev = perfcompare_utils.get_stddev(statistics_base_perf_data, header)
                    base_median_value = perfcompare_utils.get_median(statistics_base_perf_data)
                    new_avg_value = perfcompare_utils.get_avg(statistics_new_perf_data, header)
                    new_stddev = perfcompare_utils.get_stddev(statistics_new_perf_data, header)
                    new_median_value = perfcompare_utils.get_median(statistics_new_perf_data)
                    base_stddev_pct = perfcompare_utils.get_stddev_pct(base_avg_value, base_stddev)
                    new_stddev_pct = perfcompare_utils.get_stddev_pct(new_avg_value, new_stddev)
                    confidence = perfcompare_utils.get_abs_ttest_value(
                        statistics_base_perf_data, statistics_new_perf_data
                    )
                    confidence_text = perfcompare_utils.get_confidence_text(confidence)
                    delta_value = perfcompare_utils.get_delta_value(new_avg_value, base_avg_value)
                    delta_percentage = perfcompare_utils.get_delta_percentage(
                        delta_value, base_avg_value
                    )
                    magnitude = perfcompare_utils.get_magnitude(delta_percentage)
                    new_is_better = perfcompare_utils.is_new_better(delta_value, lower_is_better)
                    is_confident = perfcompare_utils.is_confident(
                        base_runs_count, new_runs_count, confidence
                    )
                    more_runs_are_needed = perfcompare_utils.more_runs_are_needed(
                        is_complete, is_confident, base_runs_count
                    )
                    class_name = perfcompare_utils.get_class_name(
                        new_is_better, base_avg_value, new_avg_value, confidence
                    )

                    is_improvement = class_name == "success"
                    is_regression = class_name == "danger"
                    is_meaningful = class_name == ""

                    row_result = {
                        **common_result,
                        "base_avg_value": base_avg_value,
                        "new_avg_value": new_avg_value,
                        "base_median_value": base_median_value,
                        "new_median_value": new_median_value,
                        "base_stddev": base_stddev,
                        "new_stddev": new_stddev,
                        "confidence": confidence,
                        "confidence_text": confidence_text,
                        "delta_value": delta_value,
                        "delta_percentage": delta_percentage,
                        "magnitude": magnitude,
                        "new_is_better": new_is_better,
                        "lower_is_better": lower_is_better,
                        "is_confident": is_confident,
                        "more_runs_are_needed": more_runs_are_needed,
                        "is_improvement": is_improvement,
                        "is_regression": is_regression,
                        "is_meaningful": is_meaningful,
                        "base_stddev_pct": base_stddev_pct,
                        "new_stddev_pct": new_stddev_pct,
                    }

                    self.queryset.append(row_result)

        serializer = self.get_serializer(self.queryset, many=True)
        serialized_data = serializer.data
        return Response(data=serialized_data)

    def _get_signature_based_properties(self, sig, option_collection_map):
        return (
            sig.get("extra_options", ""),
            sig.get("lower_is_better", ""),
            self._get_option_name(sig, option_collection_map),
            sig.get("signature_hash", ""),
            sig.get("suite", ""),
            sig.get("test", ""),
        )

    @staticmethod
    def _get_option_name(sig, option_collection_map):
        return option_collection_map.get(sig.get("option_collection_id", ""), "")

    @staticmethod
    def _get_push_timestamp(base_push, new_push):
        # This function will determine the right push time stamp to assign a revision.
        # It will do this by comparing timestamps with ph_time_ranges
        new_push_timestamp = new_push.time

        timestamps = [new_push_timestamp]
        if base_push:
            base_push_timestamp = base_push.time
            timestamps.append(base_push_timestamp)

        timeranges = perfcompare_utils.PERFHERDER_TIMERANGES
        values = []

        date_now = (time.time() * 1000) / 1000.0
        for ts in timestamps:
            ph_value = date_now - to_timestamp(str(ts))
            for ph_range in timeranges:
                if ph_value < ph_range["value"]:
                    values.append(ph_range["value"])
                    break
        return max(values)

    @staticmethod
    def _get_perf_data(repository_name, revision, signatures, interval, startday, endday):
        signature_ids = [signature["id"] for signature in list(signatures)]
        perf_data = PerformanceDatum.objects.select_related("push", "repository", "id").filter(
            signature_id__in=signature_ids,
            repository__name=repository_name,
        )
        if revision:
            perf_data = perf_data.filter(push__revision=revision)
        elif interval and not startday and not endday:
            perf_data = perf_data.filter(
                push_timestamp__gt=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))
                )
            )
        else:
            perf_data = perf_data.filter(push_timestamp__gt=startday, push_timestamp__lt=endday)

        return perf_data

    @staticmethod
    def _get_signatures(repository_name, framework, parent_signature, interval, no_subtests):
        signatures = PerformanceSignature.objects.select_related(
            "framework", "repository", "platform", "push", "job"
        ).filter(repository__name=repository_name)
        signatures = signatures.filter(parent_signature__isnull=no_subtests)
        if framework:
            signatures = signatures.filter(framework__id=framework)
        if parent_signature:
            signatures = signatures.filter(parent_signature_id=parent_signature)
        if interval:
            signatures = signatures.filter(
                last_updated__gte=datetime.datetime.utcfromtimestamp(
                    int(time.time() - int(interval))
                )
            )
        signatures = signatures.values(
            "framework_id",
            "id",
            "lower_is_better",
            "has_subtests",
            "extra_options",
            "suite",
            "signature_hash",
            "platform__platform",
            "test",
            "option_collection_id",
            "parent_signature_id",
            "repository_id",
            "measurement_unit",
            "application",
        )
        return signatures

    @staticmethod
    def _create_graph_links(
        base_repo_name,
        new_repo_name,
        base_revision,
        new_revision,
        framework,
        time_range,
        signature,
    ):
        highlighted_revision_key = "highlightedRevisions"
        time_range_key = "timerange"
        series_key = "series"

        highlighted_revisions_params = []
        if base_revision:
            highlighted_revisions_params.append((highlighted_revision_key, base_revision[:12]))
        highlighted_revisions_params.append((highlighted_revision_key, new_revision[:12]))

        encoded = urlencode(highlighted_revisions_params)
        graph_link = f"graphs?{encoded}"

        if new_repo_name == base_repo_name:
            # if repo for base and new are not the same then make diff
            # series data one for each repo, else generate one
            repo_value = ",".join([new_repo_name, signature, "1", framework])
            encoded = urlencode({series_key: repo_value})
            graph_link = f"{graph_link}&{encoded}"
        else:
            # if repos selected are not the same
            base_repo_value = ",".join([base_repo_name, signature, "1", framework])
            new_repo_value = ",".join([new_repo_name, signature, "1", framework])
            encoded = urlencode([(series_key, base_repo_value), (series_key, new_repo_value)])
            graph_link = f"{graph_link}&{encoded}"

        encoded = urlencode({time_range_key: time_range})
        graph_link = f"{graph_link}&{encoded}"

        return f"https://treeherder.mozilla.org/perfherder/{graph_link}"

    @staticmethod
    def _get_interval(base_push, new_push):
        base_push_timestamp = base_push.time
        new_push_timestamp = new_push.time

        date_now = (time.time() * 1000) / 1000.0
        time_range = min(base_push_timestamp, new_push_timestamp)
        time_range = round(date_now - to_timestamp(str(time_range)))

        ph_ranges = perfcompare_utils.PERFHERDER_TIMERANGES
        for ph_range in ph_ranges:
            if ph_range["value"] >= time_range:
                new_time_range = ph_range["value"]
                break
        return new_time_range

    @staticmethod
    def _get_grouped_perf_data(perf_data):
        grouped_replicate_values = defaultdict(list)
        grouped_values = defaultdict(list)
        grouped_job_ids = defaultdict(list)
        for signature_id, value, job_id in perf_data.values_list("signature_id", "value", "job_id"):
            if value is not None:
                grouped_values[signature_id].append(value)
                grouped_job_ids[signature_id].append(job_id)
        for signature_id, replicate_value in perf_data.values_list(
            "signature_id", "performancedatumreplicate__value"
        ):
            if replicate_value is not None:
                grouped_replicate_values[signature_id].append(replicate_value)
        return grouped_job_ids, grouped_values, grouped_replicate_values

    @staticmethod
    def _get_signatures_map(signatures, grouped_values, option_collection_map):
        """
        @return: signatures_map - contains a mapping of all the signatures for easy access and matching
                 header_names - list of header names for all given signatures
                 platforms - list of platforms for all given signatures
        """
        header_names = []
        platforms = []
        signatures_map = {}
        for signature in signatures:
            suite = signature["suite"]
            test = signature["test"]
            extra_options = signature["extra_options"]
            application = signature["application"]
            option_name = option_collection_map[signature["option_collection_id"]]
            test_suite = perfcompare_utils.get_test_suite(suite, test)
            platform = signature["platform__platform"]
            header = perfcompare_utils.get_header_name(
                extra_options, option_name, test_suite, application
            )
            sig_identifier = perfcompare_utils.get_sig_identifier(header, platform)

            if sig_identifier not in signatures_map or (
                sig_identifier in signatures_map
                and len(grouped_values.get(signature["id"], [])) != 0
            ):
                signatures_map[sig_identifier] = signature
            header_names.append(header)
            platforms.append(platform)

        return signatures_map, header_names, platforms

    """
    _process_new_stats does the following for base and new:
    1. calculate basic statistics, mean, median, variance, standard deviation, average, min, max
    2. Runs a Shapiro-Wilk normality test, is it normal and interpretation
    3. Runs a Kolmogorov-Smirnov test for goodness of fit, is fit good and interpretation
    4. Runs a Mann-Whitney U test test null hypothesis, data between two base and new, calculates p-value
    5. Calculate Cliff's delta and interpretation, check if new is better than base based on delta and lower_is_better
    6. Interpret Common Language Effect Size, with p-value and p-threshold (.05), calculate statistical effect and significance with what level of confidence interval
    7. Estimate out KDE with Silverman bandwidth, check if multimodal or irregular, calc interpretation if regressed, improved, or neutral
    8. Plot KDE with ISJ bandwidth to reduce smoothing
    """

    @staticmethod
    def _process_stats(
        base_rev_data,
        new_rev_data,
        header,
        lower_is_better,
        remove_outliers=stats.ENABLE_REMOVE_OUTLIERS,
        pvalue_threshold=stats.PVALUE_THRESHOLD,
    ):
        # extract data, potentially removing outliers
        if remove_outliers:
            base_rev_data = stats.remove_outliers(base_rev_data)
            new_rev_data = stats.remove_outliers(new_rev_data)

        if not base_rev_data:
            base_rev_data = []

        if not new_rev_data:
            new_rev_data = []

        # get basic statistics for both base and new with mean, median, variance, standard deviation, standard deviation percentage, min, max

        base_min = float(np.min(base_rev_data)) if len(base_rev_data) > 0 else 0
        base_max = float(np.max(base_rev_data)) if len(base_rev_data) > 0 else 0
        base_variance = float(np.var(base_rev_data)) if base_rev_data else 0
        base_mean = perfcompare_utils.get_avg(base_rev_data, header)
        base_stddev = perfcompare_utils.get_stddev(base_rev_data, header)
        base_count = len(base_rev_data)
        base_median = float(np.median(base_rev_data)) if base_rev_data else 0
        base_stddev_pct = perfcompare_utils.get_stddev_pct(base_mean, base_stddev)

        new_min = float(np.min(new_rev_data)) if len(new_rev_data) > 0 else 0
        new_max = float(np.max(new_rev_data)) if len(new_rev_data) > 0 else 0
        new_variance = float(np.var(new_rev_data)) if new_rev_data else 0
        new_mean = perfcompare_utils.get_avg(new_rev_data, header)
        new_stddev = perfcompare_utils.get_stddev(new_rev_data, header)
        new_count = len(new_rev_data)
        new_median = float(np.median(new_rev_data)) if new_rev_data else 0
        new_stddev_pct = perfcompare_utils.get_stddev_pct(new_mean, new_stddev)

        # Basic statistics, normality test"
        # Shapiro-Wilk test
        # Statistical test for normality — checks whether a dataset is normally distributed.
        # <https://en.wikipedia.org/wiki/Shapiro%E2%80%93Wilk_test>
        # Is both a classic Gaussian distribution or classic bell curve

        shapiro_results_base, shapiro_results_new, shapiro_warning = (
            stats.interpret_normality_shapiro_wilk(base_rev_data, new_rev_data, pvalue_threshold)
        )

        # Kolmogorov-Smirnov test for goodness of fit
        ks_test, is_fit_good, ks_warning = stats.interpret_ks_test(
            base_rev_data, new_rev_data, pvalue_threshold
        )

        # Mann-Whitney U test, two sided because we're never quite sure what of
        # the intent of the patch, as things stand
        # Tests the null hypothesis that the distributions of the two are identical
        mann_whitney, mann_stat, mann_pvalue = stats.interpret_mann_whitneyu(
            base_rev_data, new_rev_data
        )
        delta_value = new_median - base_median
        delta_percentage = (delta_value / base_median * 100) if base_median != 0 else 0

        # Cliff's delta to take into account effect size:
        # https://www.researchgate.net/post/What_is_the_most_appropriate_effect_size_type_for_mann_whitney_u_analysis
        # https://www.researchgate.net/publication/262763337_Cliff's_Delta_Calculator_A_non-parametric_effect_size_program_for_two_groups_of_observations
        # https://stats.stackexchange.com/questions/450495/cliffs-delta-in-python
        # https://github.com/neilernst/cliffsDelta
        c_warning = None
        c_delta = None
        # Handle for empty data sets
        if len(base_rev_data) < 1 or len(new_rev_data) < 1:
            c_warning = "Empty data in one group, cannot compute Cliffs Delta"
        else:
            c_delta, _ = cliffs_delta(base_rev_data, new_rev_data)

        cliffs_interpretation = stats.interpret_effect_size(c_delta)
        direction, is_new_better = stats.is_new_better(delta_value, lower_is_better)

        # Interpret effect size
        effect_size = stats.interpret_effect_size(c_delta)

        # returns CLES, direction
        (
            cles_obj,
            cles,
            is_significant,
            cles_explanation,
            mann_whitney_u_cles,
            cliffs_delta_cles,
            p_value_cles,
        ) = stats.interpret_cles(
            mann_stat,
            mann_pvalue,
            new_rev_data,
            base_rev_data,
            pvalue_threshold,
            cliffs_interpretation,
            c_delta,
            lower_is_better,
        )
        if cles_obj:
            cles_obj["effect_size"] = effect_size
            cles_obj["cles_direction"] = direction

        # Compute KDE with Silverman bandwidth, and warn if multimodal.
        # Also compute confidence interval and interperet patch regression or improvement and warnings
        (
            silverman_kde,
            is_regression,
            is_improvement,
            more_runs_are_needed,
            warning_msgs,
            performance_intepretation,
        ) = stats.interpret_silverman_kde(base_rev_data, new_rev_data, lower_is_better)

        # Plot Kernel Density Estimator (KDE) with an ISJ (Improved Sheather-Jones) to reduce false positives from over-smoothing in Silverman

        kde_isj_plot_base, kde_isj_plot_new, isj_kde_summary_text = (
            stats.plot_kde_with_isj_bandwidth(
                base_rev_data, new_rev_data, mann_pvalue, cles, c_delta, cliffs_interpretation
            )
        )

        stats_data = {
            "base_rev_data": base_rev_data,
            "new_rev_data": new_rev_data,
            "base_standard_stats": {
                "count": base_count,
                "min": base_min,
                "max": base_max,
                "mean": base_mean,
                "median": base_median,
                "variance": base_variance,
                "stddev": base_stddev,
                "stddev_pct": base_stddev_pct,
            },
            "new_standard_stats": {
                "count": new_count,
                "min": new_min,
                "max": new_max,
                "mean": new_mean,
                "median": new_median,
                "variance": new_variance,
                "stddev": new_stddev,
                "stddev_pct": new_stddev_pct,
            },
            "delta_value": delta_value,
            "delta_percentage": delta_percentage,
            "mann_pvalue": float(mann_pvalue) if mann_pvalue else None,
            # i.i.d tests
            "shapiro_wilk_test_base": shapiro_results_base,
            "shapiro_wilk_test_new": shapiro_results_new,
            "shapiro_wilk_warnings": shapiro_warning,
            "ks_test": ks_test,
            "ks_warning": ks_warning,
            "mann_whitney_test": mann_whitney,
            # cliffs delta
            "cliffs_delta": c_delta,
            "cliffs_interpretation": cliffs_interpretation,
            "warning_c_delta": c_warning,
            "is_fit_good": is_fit_good,
            "is_new_better": is_new_better,
            "is_significant": is_significant,
            "lower_is_better": lower_is_better,
            "is_regression": is_regression,
            "performance_intepretation": performance_intepretation,
            "is_improvement": is_improvement,
            "more_runs_are_needed": more_runs_are_needed,
            "direction_of_change": direction,  # 'neutral', 'better', or 'worse'
            "silverman_warnings": warning_msgs,
            "silverman_kde": silverman_kde,
            # CLES
            "cles": cles_obj,
            # KDE plots and summary
            "kde_base": kde_isj_plot_base,
            "kde_new": kde_isj_plot_new,
            "kde_summary_text": isj_kde_summary_text,
        }

        return stats_data


class TestSuiteHealthViewSet(viewsets.ViewSet):
    def list(self, request):
        query_params = TestSuiteHealthParamsSerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        framework_id = query_params.validated_data["framework"]
        query_set = (
            PerformanceSignature.objects.prefetch_related("performancealert")
            .filter(framework_id=framework_id, parent_signature_id=None)
            .values("suite", "test")
            .annotate(repositories=GroupConcat("repository_id", distinct=True))
            .annotate(platforms=GroupConcat("platform_id", distinct=True))
            .annotate(total_alerts=Count("performancealert"))
            .annotate(
                total_regressions=Count(
                    Case(When(performancealert__is_regression=1, then=Value(1)))
                )
            )
            .annotate(
                total_untriaged=Count(
                    Case(When(performancealert__status=PerformanceAlert.UNTRIAGED, then=Value(1)))
                )
            )
            .order_by("suite", "test")
        )

        serializer = TestSuiteHealthSerializer(query_set, many=True)
        return Response(data=serializer.data)
