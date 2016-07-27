from rest_framework import viewsets
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND

from treeherder.model.models import (Job,
                                     JobNote)

from .serializers import JobNoteSerializer


class NoteViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the note endpoint.
    """

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for a note detail

        """
        try:
            serializer = JobNoteSerializer(JobNote.objects.get(id=pk))
            return Response(serializer.data)
        except JobNote.DoesNotExist:
            return Response("No note with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

    def list(self, request, project):
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

        job = Job.objects.get(repository__name=project,
                              project_specific_id=job_id)
        serializer = JobNoteSerializer(JobNote.objects.filter(job=job),
                                       many=True)
        return Response(serializer.data)

    def create(self, request, project):
        """
        POST method implementation
        """
        JobNote.objects.create(
            job=Job.objects.get(repository__name=project,
                                project_specific_id=int(
                                    request.data['job_id'])),
            failure_classification_id=int(request.data['failure_classification_id']),
            user=request.user,
            text=request.data.get('text', ''))

        return Response(
            {'message': 'note stored for job {0}'.format(
                request.data['job_id']
            )}
        )

    def destroy(self, request, project, pk=None):
        """
        Delete a note entry
        """
        try:
            note = JobNote.objects.get(id=pk)
            note.delete()
            return Response({"message": "Note deleted"})
        except JobNote.DoesNotExist:
            return Response("No note with id: {0}".format(pk),
                            status=HTTP_404_NOT_FOUND)
