from django.db import IntegrityError
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND

from treeherder.model.models import BugJobMap, Job

from .serializers import BugJobMapSerializer


class BugJobMapViewSet(viewsets.ViewSet):
    def create(self, request, project):
        """Add a new relation between a job and a bug."""
        job_id = int(request.data['job_id'])
        bug_id = int(request.data['bug_id'])

        try:
            BugJobMap.create(
                job_id=job_id, bug_id=bug_id, user=request.user,
            )
            message = "Bug job map saved"
        except IntegrityError:
            message = "Bug job map skipped: mapping already exists"

        return Response({"message": message})

    def destroy(self, request, project, pk=None):
        """
        Delete bug-job-map entry. pk is a composite key in the form
        bug_id-job_id
        """
        job_id, bug_id = map(int, pk.split("-"))
        job = Job.objects.get(repository__name=project, id=job_id)
        BugJobMap.objects.filter(job=job, bug_id=bug_id).delete()

        return Response({"message": "Bug job map deleted"})

    def retrieve(self, request, project, pk=None):
        """
        Retrieve a bug-job-map entry. pk is a composite key in the form
        bug_id-job_id
        """
        job_id, bug_id = map(int, pk.split("-"))
        job = Job.objects.get(repository__name=project, id=job_id)
        try:
            bug_job_map = BugJobMap.objects.get(job=job, bug_id=bug_id)
            serializer = BugJobMapSerializer(bug_job_map)

            return Response(serializer.data)
        except BugJobMap.DoesNotExist:
            return Response("Object not found", status=HTTP_404_NOT_FOUND)

    def list(self, request, project):
        try:
            # Casting to list since Python 3's `map` returns an iterator,
            # which would hide any ValueError until used by the ORM below.
            job_ids = list(map(int, request.query_params.getlist('job_id')))
        except ValueError:
            return Response({"message": "Valid job_id required"}, status=400)
        if not job_ids:
            return Response({"message": "At least one job_id is required"}, status=400)

        jobs = Job.objects.filter(repository__name=project, id__in=job_ids)
        bug_job_maps = BugJobMap.objects.filter(job__in=jobs).select_related('user')
        serializer = BugJobMapSerializer(bug_job_maps, many=True)

        return Response(serializer.data)
