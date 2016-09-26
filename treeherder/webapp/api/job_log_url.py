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
            'job_id': log.job_id,
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
        job_ids = request.query_params.getlist('job_id')
        if not job_ids:
            raise ParseError(
                detail="The job_id parameter is mandatory for this endpoint")
        try:
            job_ids = [int(job_id) for job_id in job_ids]
        except ValueError:
            raise ParseError(detail="The job_id parameter(s) must be integers")

        logs = JobLog.objects.filter(job__repository__name=project,
                                     job__project_specific_id__in=job_ids)

        return Response([self._log_as_dict(log) for log in logs])
