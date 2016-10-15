from rest_framework import viewsets

from treeherder.model.models import TextLogSummary
from treeherder.webapp.api import (pagination,
                                   serializers)


class TextLogSummaryViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.TextLogSummarySerializer
    queryset = TextLogSummary.objects.prefetch_related("lines").all()
    pagination_class = pagination.IdPagination
