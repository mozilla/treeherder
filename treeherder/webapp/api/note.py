from django.conf import settings
from rest_framework import viewsets
from rest_framework.response import Response

from rest_framework.authentication import SessionAuthentication
from treeherder.webapp.api.permissions import IsStaffOrReadOnly

from treeherder.webapp.api.utils import with_jobs
from treeherder.events.publisher import JobClassificationPublisher


class NoteViewSet(viewsets.ViewSet):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsStaffOrReadOnly,)

    """
    This viewset is responsible for the note endpoint.
    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for an artifact blob

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
        """
        job_id = request.QUERY_PARAMS.get('job_id')

        objs = jm.get_job_note_list(job_id=job_id)
        return Response(objs)

    @with_jobs
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        jm.insert_job_note(
            int(request.DATA['job_id']),
            int(request.DATA['failure_classification_id']),
            request.DATA['who'],
            request.DATA.get('note', '')
        )

        publisher = JobClassificationPublisher(settings.BROKER_URL)
        try:
            publisher.publish(int(request.DATA['job_id']),
                              request.DATA['who'], project)
        finally:
            publisher.disconnect()

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
            publisher = JobClassificationPublisher(settings.BROKER_URL)
            try:
                publisher.publish(objs[0]['job_id'], objs[0]['who'], project)
            finally:
                publisher.disconnect()
            return Response({"message": "Note deleted"})

        else:
            return Response("No note with id: {0}".format(pk), 404)

