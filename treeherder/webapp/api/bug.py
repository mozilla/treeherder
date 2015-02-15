# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from time import time
from treeherder.model.derived.jobs import JobDataIntegrityError
from rest_framework import viewsets
from rest_framework.response import Response

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from treeherder.webapp.api.utils import (UrlQueryFilter, with_jobs)


class BugJobMapViewSet(viewsets.ViewSet):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsAuthenticatedOrReadOnly, )

    @with_jobs
    def create(self, request, project, jm):
        """
        Add a new relation between a job and a bug
        """
        job_id, bug_id = map(int, (request.DATA['job_id'],
                                   request.DATA['bug_id']))

        try:
            jm.insert_bug_job_map(job_id, bug_id, request.DATA['type'],
                                  int(time()), request.user.email)
        except JobDataIntegrityError as e:
            if "Duplicate" in e.message:
                return Response(
                    {"message": "Bug job map skipped: {0}".format(e.message)},
                    409
                )
            else:
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
        params.update(request.QUERY_PARAMS)
        filter = UrlQueryFilter(params)
        obj = jm.get_bug_job_map_list(0, 1, filter.conditions)
        if obj:
            return Response(obj[0])
        else:
            return Response("Object not found", 404)

    @with_jobs
    def list(self, request, project, jm):
        filter = UrlQueryFilter(request.QUERY_PARAMS)

        offset = filter.pop("offset", 0)
        count = min(int(filter.pop("count", 10)), 1000)

        objs = jm.get_bug_job_map_list(
            offset,
            count,
            filter.conditions
        )
        return Response(objs)
