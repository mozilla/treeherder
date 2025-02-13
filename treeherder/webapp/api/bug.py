from django.db import IntegrityError
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND

from treeherder.model.models import BugJobMap, Job

from .serializers import BugJobMapSerializer


class BugJobMapViewSet(viewsets.ViewSet):
    def create(self, request, project):
        """Add a new relation between a job and a bug."""
        job_id = int(request.data["job_id"])
        bug_open = bool(request.data["bug_open"])

        bugzilla_id = request.data.get("bug_id")
        internal_bug_id = request.data.get("internal_id")
        try:
            bugzilla_id = bugzilla_id and int(bugzilla_id)
            internal_bug_id = internal_bug_id and int(internal_bug_id)
        except TypeError:
            return Response("bugzilla_id and internal_id must be integers", HTTP_400_BAD_REQUEST)
        if internal_bug_id is None and bugzilla_id is None:
            return Response(
                "At least one of bug_id or internal_id is required", HTTP_400_BAD_REQUEST
            )
        bug_reference = {}
        # Use Bugzilla ID by default to handle `dupe_of` attribute correctly
        if bugzilla_id:
            bug_reference["bugzilla_id"] = bugzilla_id
        elif internal_bug_id:
            bug_reference["internal_bug_id"] = internal_bug_id
        try:
            BugJobMap.create(
                job_id=job_id,
                user=request.user,
                bug_open=bug_open,
                **bug_reference,
            )
            message = "Bug job map saved"
        except IntegrityError:
            message = "Bug job map skipped: mapping already exists"
        except ValueError as e:
            return Response(str(e), HTTP_400_BAD_REQUEST)

        return Response({"message": message})

    def destroy(self, request, project, pk=None):
        """
        Delete bug-job-map entry. pk is a composite key in the form
        job_id-bugzilla_id
        """
        job_id, bugzilla_id = map(int, pk.split("-"))
        job = Job.objects.get(repository__name=project, id=job_id)
        BugJobMap.objects.filter(job=job, bug__bugzilla_id=bugzilla_id).delete()

        return Response({"message": "Bug job map deleted"})

    def retrieve(self, request, project, pk=None):
        """
        Retrieve a bug-job-map entry. pk is a composite key in the form
        job_id-bugzilla_id
        """
        job_id, bugzilla_id = map(int, pk.split("-"))
        job = Job.objects.get(repository__name=project, id=job_id)
        try:
            bug_job_map = BugJobMap.objects.select_related("bug").get(
                job=job, bug__bugzilla_id=bugzilla_id
            )
            serializer = BugJobMapSerializer(bug_job_map)

            return Response(serializer.data)
        except BugJobMap.DoesNotExist:
            return Response("Object not found", status=HTTP_404_NOT_FOUND)

    def list(self, request, project):
        try:
            # Casting to list since Python 3's `map` returns an iterator,
            # which would hide any ValueError until used by the ORM below.
            job_ids = list(map(int, request.query_params.getlist("job_id")))
        except ValueError:
            return Response({"message": "Valid job_id required"}, status=400)
        if not job_ids:
            return Response({"message": "At least one job_id is required"}, status=400)

        jobs = Job.objects.filter(repository__name=project, id__in=job_ids)
        bug_job_maps = BugJobMap.objects.filter(job__in=jobs).select_related("user", "bug")
        serializer = BugJobMapSerializer(bug_job_maps, many=True)

        return Response(serializer.data)
