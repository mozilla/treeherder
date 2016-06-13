from rest_framework import viewsets
from rest_framework.exceptions import ParseError
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND

from treeherder.webapp.api.utils import with_jobs


class NoteViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)

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
        return Response("No note with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        job_id -- Mandatory filter indicating which job these notes belong to.
        """

        job_id = request.query_params.get('job_id')
        if not job_id:
            raise ParseError(detail="The job_id parameter is mandatory for this endpoint")
        try:
            job_id = int(job_id)
        except ValueError:
            raise ParseError(detail="The job_id parameter must be an integer")

        job_note_list = jm.get_job_note_list(job_id=job_id)
        return Response(job_note_list)

    @with_jobs
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        jm.insert_job_note(
            int(request.data['job_id']),
            int(request.data['failure_classification_id']),
            request.user.email,
            request.data.get('note', '')
        )

        return Response(
            {'message': 'note stored for job {0}'.format(
                request.data['job_id']
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
        return Response("No note with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)
