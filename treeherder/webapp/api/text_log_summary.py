import rest_framework_filters as filters
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from treeherder.model.models import TextLogSummary
from treeherder.webapp.api import (pagination,
                                   serializers)


class TextLogSummaryFilter(filters.FilterSet):
    class Meta(object):
        model = TextLogSummary
        fields = ["text_log_summary_artifact_id", "bug_suggestions_artifact_id"]


class TextLogSummaryViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)
    serializer_class = serializers.TextLogSummarySerializer
    queryset = TextLogSummary.objects.all()
    filter_class = TextLogSummaryFilter
    pagination_class = pagination.IdPagination
