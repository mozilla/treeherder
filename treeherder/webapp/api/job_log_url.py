import logging

from rest_framework import viewsets
from rest_framework.decorators import detail_route
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from treeherder.webapp.api import permissions
from treeherder.webapp.api.utils import with_jobs

logger = logging.getLogger(__name__)


class JobLogUrlViewSet(viewsets.ViewSet):
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

    """
    A job_log_url object holds a reference to a job log.
    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        Returns a job_log_url object given its ID
        """
        obj = jm.get_job_log_url_detail(pk)
        return Response(obj)

    @with_jobs
    def list(self, request, project, jm):
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

        # get_job_log_url_list takes a list of job ids
        job_log_url_list = jm.get_job_log_url_list([job_id])

        return Response(job_log_url_list)

    @detail_route(methods=['post'])
    @with_jobs
    def update_parse_status(self, request, project, jm, pk=None):
        """
        Change the log parsing status for a log reference (eg from 'pending' to 'parsed').
        """
        try:
            parse_status = request.data["parse_status"]
        except KeyError:
            raise ParseError(detail=("The parse_status parameter is mandatory for this endpoint"))
        jm.update_job_log_url_status(pk, parse_status)
        obj = jm.get_job_log_url_detail(pk)
        return Response(obj)

    @detail_route(methods=['post'])
    @with_jobs
    def parse(self, request, project, jm, pk=None):
        """Trigger an async task to parse this log."""

        log_obj = jm.get_job_log_url_detail(pk)
        job = jm.get_job(log_obj["job_id"])[0]

        log_obj["job_guid"] = job["job_guid"]
        # We can fake the result because there is only one queue for high priority
        # jobs and it doesn't depend on the result
        log_obj["result"] = None

        logger.info("{0} has requested to parse log {1}".format(
                    request.user.username, log_obj))

        jm.schedule_log_parsing([log_obj], priority="high")

        return Response({"message": "Log parsing triggered successfully"})
