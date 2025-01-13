from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework.status import (
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
)

from treeherder.model.models import BugJobMap, Job, JobNote


class ClassificationViewSet(mixins.ListModelMixin, viewsets.ViewSet):
    """
    This viewset is responsible for the classification endpoint.
    """

    def delete(self, request, project, format=None):
        """
        Delete both the classification type and the bugs linked to the task
        """
        if not request.user:
            return Response("Must be logged in", status=HTTP_401_UNAUTHORIZED)
        if not request.user.is_staff:
            return Response("Must be staff or in sheriffing group", status=HTTP_403_FORBIDDEN)
        job_ids = [job["id"] for job in request.data]
        if not job_ids:
            return Response("Must provide job IDs", status=HTTP_404_NOT_FOUND)
        Job.objects.filter(id__in=job_ids).update(failure_classification_id=1)
        JobNote.objects.filter(job_id__in=job_ids).delete()
        BugJobMap.objects.filter(job_id__in=job_ids).delete()
        return Response({"message": "Notes and bug classifications deleted"})
