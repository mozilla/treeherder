from rest_framework import viewsets
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from treeherder.model.models import JobLog


class JobLogUrlViewSet(viewsets.ViewSet):
    """
    A job_log_url object holds a reference to a job log.
    """

    @staticmethod
    def _log_as_dict(log):
        return {
            'id': log.id,
            'name': log.name,
            'url': log.url,
            'parse_status': log.get_status_display(),
        }

    def retrieve(self, request, project, pk=None):
        """
        Returns a job_log_url object given its ID
        """
        log = JobLog.objects.get(id=pk)
        return Response(self._log_as_dict(log))

    def list(self, request, project):
        """
        GET method implementation for list view
        job_id -- Mandatory filter indicating which job these log belongs to.
        """
        job_id = request.query_params.get('job_id')
        if not job_id:
            raise ParseError(
                detail="The job_id parameter is mandatory for this endpoint")
        try:
            job_id = int(job_id)
        except ValueError:
            raise ParseError(detail="The job_id parameter must be an integer")

        logs = JobLog.objects.filter(job__repository__name=project,
                                     job__project_specific_id=job_id)

        return Response([self._log_as_dict(log) for log in logs])
