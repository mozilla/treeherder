from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND

from treeherder.model.models import Job, JobNote, Push

from .serializers import JobNoteSerializer, JobNoteDetailSerializer


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

        job = Job.objects.get(repository__name=project, id=job_id)
        serializer = JobNoteSerializer(JobNote.objects.filter(job=job), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def push_notes(self, request, project):
        """
        GET method to get all classifications for a push revision with some
        job details
        :param request: Require `revision` as a SHA
        :param project: Repository of the revision
        :return:
        """
        revision = request.query_params.get('revision')
        if not revision:
            raise ParseError(detail="The revision parameter is mandatory for this endpoint")

        push = Push.objects.get(repository__name=project, revision=revision)
        notes = JobNote.objects.filter(job__push=push).select_related(
            'job', 'job__push', 'job__job_type', 'job__taskcluster_metadata'
        )
        serializer = JobNoteDetailSerializer(notes, many=True)
        return Response(serializer.data)

    def create(self, request, project):
        """
        POST method implementation
        """
        JobNote.objects.create(
            job=Job.objects.get(repository__name=project, id=int(request.data['job_id'])),
            failure_classification_id=int(request.data['failure_classification_id']),
            user=request.user,
            text=request.data.get('text', ''),
        )

        return Response({'message': 'note stored for job {0}'.format(request.data['job_id'])})

    def destroy(self, request, project, pk=None):
        """
        Delete a note entry
        """
        try:
            note = JobNote.objects.get(id=pk)
            note.delete()
            return Response({"message": "Note deleted"})
        except JobNote.DoesNotExist:
            return Response("No note with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)
