import gzip
import json
import urllib2

from django.conf import settings
from django.core.cache import caches
from django.utils.six import BytesIO
from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.webapp.api.exceptions import ResourceNotFoundException
from treeherder.webapp.api.utils import with_jobs

filesystem = caches['filesystem']


class LogSliceView(viewsets.ViewSet):

    """
    This view serves slices of the log
    """

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        return urllib2.urlopen(
            url,
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

        # get only the log that matches the ``log_name``
        logs = jm.get_log_references(job_id)

        # @todo: remove after no more logs named 'builds-4h' exist in the db.  Should be after Aug 30, 2015.
        exp_log_names = [log_name, 'builds-4h']

        try:
            log = next(log for log in logs if log["name"] in exp_log_names)
        except StopIteration:
            act_log_names = [x["name"] for x in logs]
            raise ResourceNotFoundException(
                "Expected log names of {} not found in {} for job_id {}".format(
                    exp_log_names,
                    act_log_names,
                    job_id,
                    ))

        try:
            url = log.get("url")
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
