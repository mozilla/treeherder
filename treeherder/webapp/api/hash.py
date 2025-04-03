import logging

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from treeherder.model.models import Commit

logger = logging.getLogger(__name__)


class HashViewSet(viewsets.ViewSet):
    @action(detail=False)
    def tocommit(self, request, project):
        newhash = request.query_params.get("newHash")
        originalhash = request.query_params.get("originalHash")
        newpush = Commit.objects.filter(comments__contains=newhash).first().revision
        originalpush = Commit.objects.filter(comments__contains=originalhash).first().revision
        return Response({"originalRevision": originalpush, "newRevision": newpush})
