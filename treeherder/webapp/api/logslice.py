import gzip
import json

from django.core.cache import caches
from django.utils.six import BytesIO
from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.etl.common import make_request
from treeherder.model.models import (Job,
                                     JobLog)

filesystem = caches['filesystem']


class LogSliceView(viewsets.ViewSet):

    """
    This view serves slices of the log
    """

    def list(self, request, project):
        """
        GET method implementation for log slicer

        Receives a line range and job_id and returns those lines
        """
        job_id = request.query_params.get("job_id")
        log_name = request.query_params.get("name")
        if log_name:
            log_names = [log_name]
        else:
            log_names = ["buildbot_text", "builds-4h"]
        format = 'json' if log_name == 'mozlog_json' else 'text'

        file = None

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
                job=job, name__in=log_names)[0:1].values_list('url',
                                                              flat=True)[0]
        except JobLog.DoesNotExist:
            return Response("Job log does not exist", 404)

        try:
            file = filesystem.get(url)
            if not file:
                r = make_request(url)
                try:
                    file = gzip.GzipFile(fileobj=BytesIO(r.content))
                    # read 16 bytes, just to make sure the file is gzipped
                    file.read(16)
                    file.seek(0)
                    filesystem.set(url, file.fileobj)
                except IOError:
                    # file is not gzipped, but we should still store / read
                    # it as such, to save space
                    file = BytesIO(r.content)
                    gz_file_content = BytesIO()
                    with gzip.GzipFile('none', 'w', fileobj=gz_file_content) as gz:
                        gz.write(r.content)
                    filesystem.set(url, gz_file_content)
            else:
                file = gzip.GzipFile(fileobj=file)

            lines = []
            for i, line in enumerate(file):
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
            if file:
                file.close()
