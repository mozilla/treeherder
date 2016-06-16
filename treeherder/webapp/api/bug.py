import time

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.models import (BugJobMap,
                                     Job)


class BugJobMapViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)

    def create(self, request, project):
        """
        Add a new relation between a job and a bug
        """
        job_id, bug_id = map(int, (request.data['job_id'],
                                   request.data['bug_id']))

        job = Job.objects.get(repository__name=project,
                              project_specific_id=job_id)
        created, _ = BugJobMap.objects.get_or_create(
            job=job, bug_id=bug_id, defaults={
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
        job = Job.objects.get(repository__name=project,
                              project_specific_id=job_id)
        BugJobMap.objects.filter(job=job, bug_id=bug_id).delete()

        return Response({"message": "Bug job map deleted"})

    @staticmethod
    def _get_bug_job_map_as_dict(bug_job_map):
        if bug_job_map.user:
            type = "manual"
        else:
            type = "autoclassify"

        return {
            'job_id': bug_job_map.job.project_specific_id,
            'bug_id': bug_job_map.bug_id,
            'type': type,
            'submit_timestamp': int(time.mktime(bug_job_map.created.timetuple())),
            'who': bug_job_map.who
        }

    def retrieve(self, request, project, pk=None):
        """
        Retrieve a bug-job-map entry. pk is a composite key in the form
        bug_id-job_id
        """
        job_id, bug_id = map(int, pk.split("-"))
        job = Job.objects.get(repository__name=project,
                              project_specific_id=job_id)
        try:
            bug_job_map = BugJobMap.objects.get(job=job, bug_id=bug_id)
            return Response(self._get_bug_job_map_as_dict(bug_job_map))
        except BugJobMap.DoesNotExist:
            return Response("Object not found", 404)

    def list(self, request, project):
        job_ids = map(int, request.query_params.getlist('job_id'))
        if not job_ids:
            return Response({"message": "At least one job_id is required"},
                            status=400)

        jobs = Job.objects.filter(
            repository__name=project,
            project_specific_id__in=job_ids)

        bug_job_maps = BugJobMap.objects.filter(job__in=jobs).select_related(
            'user')

        return Response([self._get_bug_job_map_as_dict(bjm) for bjm in
                         bug_job_maps])
