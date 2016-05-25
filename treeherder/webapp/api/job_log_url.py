from rest_framework import viewsets
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from treeherder.model.models import (Job,
                                     JobLog,
                                     Repository)


class JobLogUrlViewSet(viewsets.ReadOnlyModelViewSet):
    """
    A job_log_url object holds a reference to a job log.
    """

    @staticmethod
    def _log_as_dict(log):
        return {
            'id': log.id,
            'name': log.name,
            'url': log.url,
            'parse_status': log.STATUSES[log.status][1]
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
        repository = Repository.objects.get(name=project)

        job_id = request.query_params.get('job_id')
        if not job_id:
            raise ParseError(
                detail="The job_id parameter is mandatory for this endpoint")
        try:
            job_id = int(job_id)
        except ValueError:
            raise ParseError(detail="The job_id parameter must be an integer")

        jobs = Job.objects.filter(repository=repository,
                                  project_specific_id=job_id)
        return Response([self._log_as_dict(log) for log in
                         JobLog.objects.filter(job__in=jobs)])
