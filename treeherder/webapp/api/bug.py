from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND

from treeherder.model.models import (BugJobMap,
                                     Job)

from .serializers import BugJobMapSerializer


class BugJobMapViewSet(viewsets.ViewSet):

    def create(self, request, project):
        """
        Add a new relation between a job and a bug
        """
        job_id, bug_id = map(int, (request.data['job_id'],
                                   request.data['bug_id']))

        _, created = BugJobMap.objects.get_or_create(
            job_id=job_id, bug_id=bug_id, defaults={
                'user': request.user
            })
        if created:
            return Response({
                "message": "Bug job map skipped: mapping already exists"
            }, 200)

        return Response({"message": "Bug job map saved"})

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
        job_ids = map(int, request.query_params.getlist('job_id'))
        if not job_ids:
            return Response({"message": "At least one job_id is required"},
                            status=400)

        jobs = Job.objects.filter(repository__name=project, id__in=job_ids)
        bug_job_maps = BugJobMap.objects.filter(job__in=jobs).select_related(
            'user')
        serializer = BugJobMapSerializer(bug_job_maps, many=True)

        return Response(serializer.data)
