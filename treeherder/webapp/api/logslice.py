import gzip
import json
import urllib2

from django.conf import settings
from django.core.cache import caches
from django.utils.six import BytesIO
from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.model.models import (Job,
                                     JobLog)
from treeherder.webapp.api.utils import with_jobs

filesystem = caches['filesystem']


class LogSliceView(viewsets.ViewSet):

    """
    This view serves slices of the log
    """

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        req = urllib2.Request(url)
        req.add_header('User-Agent', settings.TREEHERDER_USER_AGENT)
        return urllib2.urlopen(
            req,
            timeout=settings.REQUESTS_TIMEOUT
        )

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for log slicer

        Receives a line range and job_id and returns those lines
        """
        job_id = request.query_params.get("job_id")
        log_name = request.query_params.get("name", "buildbot_text")
        format = 'json' if log_name == 'mozlog_json' else 'text'

        handle = None
        gz_file = None

        start_line = request.query_params.get("start_line")
        end_line = request.query_params.get("end_line")
        if not start_line or not end_line:
            return Response("``start_line`` and ``end_line`` parameters are both required", 400)

        try:
            start_line = abs(int(start_line))
            end_line = abs(int(end_line))
        except ValueError:
            return Response("parameters could not be converted to integers", 400)

        if start_line >= end_line:
            return Response("``end_line`` must be larger than ``start_line``", 400)

        try:
            job = Job.objects.get(repository__name=project,
                                  project_specific_id=job_id)
        except Job.DoesNotExist:
            return Response("Job does not exist", 404)

        try:
            url = JobLog.objects.filter(
                job=job, name=log_name)[0:1].values_list('url',
                                                         flat=True)[0]
        except JobLog.DoesNotExist:
            return Response("Job log does not exist", 404)

        try:
            gz_file = filesystem.get(url)

            if not gz_file:
                handle = self.get_log_handle(url)
                gz_file = gzip.GzipFile(fileobj=BytesIO(handle.read()))
                filesystem.set(url, gz_file.fileobj)
            else:
                gz_file = gzip.GzipFile(fileobj=gz_file)

            lines = []

            for i, line in enumerate(gz_file):
                if i < start_line:
                    continue
                elif i >= end_line:
                    break

                if format == 'json':
                    lines.append({"data": json.loads(line), "index": i})
                else:
                    lines.append({"text": line, "index": i})

            return Response(lines)

        finally:
            if handle:
                handle.close()
            if gz_file:
                gz_file.close()
