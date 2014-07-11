from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.exceptions import ParseError
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from treeherder.webapp.api.utils import with_jobs, oauth_required


class JobLogUrlViewSet(viewsets.ViewSet):
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

        job_id = request.QUERY_PARAMS.get('job_id')
        if not job_id:
            raise ParseError(detail="The job_id parameter is mandatory for this endpoint")
        try:
            job_id = int(job_id)
        except ValueError:
            raise ParseError(detail="The job_id parameter must be an integer")

        job_note_list = jm.get_job_log_url_list(job_id=job_id)
        return Response(job_note_list)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        job_id -- Mandatory filter indicating which job these log belongs to.
        """

        job_id = request.QUERY_PARAMS.get('job_id')
        if not job_id:
            raise ParseError(detail="The job_id parameter is mandatory for this endpoint")
        try:
            job_id = int(job_id)
        except ValueError:
            raise ParseError(detail="The job_id parameter must be an integer")

        # get_job_log_url_list takes a lost of job ids
        job_log_url_list = jm.get_job_log_url_list([job_id])
        return Response(job_log_url_list)

    @action()
    @with_jobs
    @oauth_required
    def update_parse_status(self, request, project, jm, pk=None):
        """
        Change the state of a job.
        """
        try:
            parse_status = request.DATA["parse_status"]
            parse_timestamp = request.DATA["parse_timestamp"]
            jm.update_job_log_url_status(pk, parse_status, parse_timestamp)
            obj = jm.get_job_log_url_detail(pk)
            return Response(obj)
        except KeyError:
            raise ParseError(detail=("The parse_status and parse_timestamp parameters"
                                     " are mandatory for this endpoint"))

    @action(permission_classes=[IsAuthenticated])
    @with_jobs
    def parse(self, request, project, jm, pk=None):
        """
        Trigger an async task to parse this log. This can be requested by the ui
        in case the log parsing had an intermittent failure
        """
        log_obj = jm.get_job_log_url_detail(pk)
        job = jm.get_job(log_obj["job_id"])
        has_failed = job["result"] in jm.FAILED_RESULTS

        from treeherder.log_parser.tasks import parse_log

        parse_log.delay(project, log_obj["url"],
                        job["job_guid"], job["resultset_id"],
                        check_errors=has_failed)
        return Response({"message": "Log parsing triggered successfully"})
