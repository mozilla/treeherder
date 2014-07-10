from rest_framework import viewsets
from rest_framework.response import Response
from django.core import cache

from treeherder.webapp.api.utils import (with_jobs)
from treeherder.webapp.api.exceptions import ResourceNotFoundException
from django.conf import settings

import urllib2
import gzip
import io
import logging

filesystem = cache.get_cache('filesystem')

class LogSliceView(viewsets.ViewSet):
    """
    This view serves slices of the log
    """

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        return urllib2.urlopen(
            url,
            timeout=settings.TREEHERDER_REQUESTS_TIMEOUT
        )

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for log slicer

        Receives a line range and job_id and returns those lines
        """
        job_id = request.QUERY_PARAMS.get("job_id")

        log = jm.get_log_references(job_id)

        handle = None
        gz_file = None

        try:
            start_line = abs(int(request.QUERY_PARAMS.get("start_line", 0)))
            end_line = abs(int(request.QUERY_PARAMS.get("end_line", 0)))
        except Exception as e:
            return Response("parameters could not be converted to integers", 400)

        if start_line >= end_line:
            return Response("end_line must be larger than start_line", 400)

        if len(log) > 0:
            try:
                url = log[0].get("url")
                gz_file = filesystem.get(url)

                if not gz_file:
                    handle = self.get_log_handle(url)
                    gz_file = gzip.GzipFile(fileobj=io.BytesIO(handle.read()))
                    filesystem.set(url, gz_file.fileobj)
                else:
                    gz_file = gzip.GzipFile(fileobj=gz_file)

                lines = []

                for i, line in enumerate(gz_file):
                    if i < start_line: continue
                    elif i >= end_line: break

                    lines.append({"text": line, "index": i})

                return Response(lines)

            except Exception as e:
                logging.error(e)
                raise ResourceNotFoundException("log file not found")

            finally:
                if handle:
                    handle.close()
                if gz_file:
                    gz_file.close()

        else:
            raise ResourceNotFoundException("job_artifact {0} not found".format(job_id))
