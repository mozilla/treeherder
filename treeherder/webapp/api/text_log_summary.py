import rest_framework_filters as filters
from rest_framework import viewsets

from treeherder.model.models import TextLogSummary
from treeherder.webapp.api import (pagination,
                                   serializers)


class TextLogSummaryFilter(filters.FilterSet):
    class Meta(object):
        model = TextLogSummary
        fields = ["text_log_summary_artifact_id", "bug_suggestions_artifact_id"]


class TextLogSummaryViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.TextLogSummarySerializer
    queryset = TextLogSummary.objects.prefetch_related("lines").all()
    filter_class = TextLogSummaryFilter
    pagination_class = pagination.IdPagination
