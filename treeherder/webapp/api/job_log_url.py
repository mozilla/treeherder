import logging

from rest_framework import viewsets
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from treeherder.model.models import JobLog
from treeherder.webapp.api.utils import with_jobs

logger = logging.getLogger(__name__)


class JobLogUrlViewSet(viewsets.ReadOnlyModelViewSet):
    """
    A job_log_url object holds a reference to a job log.
    """

    @staticmethod
    def _log_as_dict(log):
        return {
            'name': log.name,
            'url': log.url,
            'status': log.STATUSES[log.status][1]
        }

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        Returns a job_log_url object given its ID
        """
        log = JobLog.objects.get(id=pk)
        return Response(self._log_as_dict(log))

    @with_jobs
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

        return Response([self._log_as_dict(log) for log in
                         JobLog.objects.filter(
                             job__project_specific_id=job_id)])
