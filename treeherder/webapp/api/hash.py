import logging
from datetime import datetime, timedelta

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.model.models import Commit
from treeherder.webapp.api.serializers import HashQuerySerializer

logger = logging.getLogger(__name__)


class HashViewSet(viewsets.ViewSet):
    @action(detail=False)
    def tocommit(self, request, project):
        query_params = HashQuerySerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)
        newhash = query_params.validated_data["newhash"]
        basehash = query_params.validated_data["basehash"]
        today = datetime.now().strftime("%Y-%m-%d")
        start_date_range = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        newpush = Commit.objects.filter(
            comments__contains=newhash,
            push__repository=4,
            push__time__range=(start_date_range, today),
        ).first()
        basepush = Commit.objects.filter(
            comments__contains=basehash,
            push__repository=4,
            push__time__range=(start_date_range, today),
        ).first()
        query_params.validate_pushes(newpush, newhash, basepush, basehash)
        return Response({"baseRevision": basepush.revision, "newRevision": newpush.revision})
