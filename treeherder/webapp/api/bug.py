from time import time

from rest_framework import (status,
                            viewsets)
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.derived.jobs import JobDataIntegrityError
from treeherder.webapp.api.utils import (UrlQueryFilter,
                                         with_jobs)


class BugJobMapViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)

    @with_jobs
    def create(self, request, project, jm):
        """
        Add a new relation between a job and a bug
        """
        job_id, bug_id = map(int, (request.data['job_id'],
                                   request.data['bug_id']))

        try:
            jm.insert_bug_job_map(job_id, bug_id, request.data['type'],
                                  int(time()), request.user.email)
        except JobDataIntegrityError as e:
            if e.message[0] == 1062 or "Duplicate" in e.message[1]:
                return Response({"message": "Bug job map skipped: {0}".format(e.message)})
            raise e

        return Response({"message": "Bug job map saved"})

    @with_jobs
    def destroy(self, request, project, jm, pk=None):
        """
        Delete bug-job-map entry. pk is a composite key in the form
        bug_id-job_id
        """
        job_id, bug_id = map(int, pk.split("-"))
        jm.delete_bug_job_map(job_id, bug_id)
        return Response({"message": "Bug job map deleted"})

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        Retrieve a bug-job-map entry. pk is a composite key in the form
        bug_id-job_id
        """
        job_id, bug_id = map(int, pk.split("-"))
        params = {
            "bug_id": bug_id,
            "job_id": job_id
        }
        params.update(request.query_params)
        filter = UrlQueryFilter(params)
        obj = jm.get_bug_job_map_list(0, 1, filter.conditions)
        if obj:
            return Response(obj[0])
        return Response("Object not found", status=status.HTTP_404_NOT_FOUND)

    @with_jobs
    def list(self, request, project, jm):
        filter = UrlQueryFilter(request.query_params)

        offset = int(filter.pop("offset", 0))
        count = min(int(filter.pop("count", 10)), 1000)

        objs = jm.get_bug_job_map_list(
            offset,
            count,
            filter.conditions
        )
        return Response(objs)
