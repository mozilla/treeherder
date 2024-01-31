from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.changelog.changes import get_changes

from .serializers import ChangelogSerializer


class ChangelogViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the changelog endpoint.
    """

    def list(self, request):
        """
        GET method implementation for list view
        """
        start_date = request.query_params.get("startdate")  # YYYY-MM-DD
        end_date = request.query_params.get("enddate")  # YYYY-MM-DD

        serializer = ChangelogSerializer(get_changes(start_date, end_date), many=True)
        return Response(serializer.data)
