# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from treeherder.webapp.api.utils import with_jobs


class NoteViewSet(viewsets.ViewSet):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsAuthenticatedOrReadOnly, )

    """
    This viewset is responsible for the note endpoint.
    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for a note detail

        """
        obj = jm.get_job_note(pk)
        if obj:
            return Response(obj[0])
        else:
            return Response("No note with id: {0}".format(pk), 404)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        job_id -- Mandatory filter indicating which job these notes belong to.
        """

        job_id = request.QUERY_PARAMS.get('job_id')
        if not job_id:
            raise ParseError(detail="The job_id parameter is mandatory for this endpoint")
        try:
            job_id = int(job_id)
        except:
            raise ParseError(detail="The job_id parameter must be an integer")

        job_note_list = jm.get_job_note_list(job_id=job_id)
        return Response(job_note_list)

    @with_jobs
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        jm.insert_job_note(
            int(request.DATA['job_id']),
            int(request.DATA['failure_classification_id']),
            request.user.email,
            request.DATA.get('note', '')
        )

        return Response(
            {'message': 'note stored for job {0}'.format(
                request.DATA['job_id']
            )}
        )

    @with_jobs
    def destroy(self, request, project, jm, pk=None):
        """
        Delete a note entry
        """
        objs = jm.get_job_note(pk)
        if objs:
            jm.delete_job_note(pk, objs[0]['job_id'])
            return Response({"message": "Note deleted"})
        else:
            return Response("No note with id: {0}".format(pk), 404)
