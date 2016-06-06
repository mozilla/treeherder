from rest_framework import viewsets
from rest_framework.exceptions import ParseError
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.models import (Job,
                                     JobNote)


class NoteViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)

    @staticmethod
    def _get_note_as_dict(note):
        return {
            'id': note.id,
            'job_id': note.job.project_specific_id,
            'failure_classification_id': note.failure_classification.id,
            'who': note.who,
            'note': note.text
        }

    """
    This viewset is responsible for the note endpoint.
    """
    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for a note detail

        """
        try:
            return Response(self._get_note_as_dict(JobNote.objects.get(
                id=pk)))
        except JobNote.DoesNotExist:
            return Response("No note with id: {0}".format(pk), 404)

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
        except:
            raise ParseError(detail="The job_id parameter must be an integer")

        job = Job.objects.get(repository__name=project,
                              project_specific_id=job_id)
        job_notes = JobNote.objects.filter(job=job)

        return Response([self._get_note_as_dict(job_note) for job_note in
                         job_notes])

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
            text=request.data.get('note', ''))

        return Response(
            {'message': 'note stored for job {0}'.format(
                request.data['job_id']
            )}
        )

    def destroy(self, request, project, pk=None):
        """
        Delete a note entry
        """
        note = JobNote.objects.get(id=pk)
        if note:
            note.delete()
            return Response({"message": "Note deleted"})

        return Response("No note with id: {0}".format(pk), 404)
