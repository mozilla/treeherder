import json
import ast

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import link

from treeherder.webapp.api.utils import (with_jobs)

class PerformanceDataViewSet(viewsets.ViewSet):
    """
    This view serves performance charts data
    """

    @link()
    @with_jobs
    def get_signatures_from_properties(self, request, project, jm, pk=None):
        """
        GET method implementation for signature data

        Input: property/value pairs
        Output: unique signatures
        """

        print(request.QUERY_PARAMS)

        try:
            props = json.loads(request.QUERY_PARAMS.get("properties", {}))
        except Exception as e:
            return Response("incorrect parameters", 400)

        signatures = jm.get_signatures_from_properties(props)

        return Response(signatures)

    @link()
    @with_jobs
    def get_performance_data(self, request, project, jm, pk=None):
        """
        GET method implementation for performance data

        Input: list of series signatures
        Output: performance charting data
        """

        signature_string = request.QUERY_PARAMS.get("signatures", "[]")

        try:
            interval_seconds = abs(int(request.QUERY_PARAMS.get("interval_seconds", 0)))
            signatures = ast.literal_eval(signature_string)
            signatures = [n.strip() for n in signatures]
        except Exception as e:
            return Response("incorrect parameters", 400)

        if not signatures:
            return Response("no signatures provided", 400)

        data = jm.get_performance_series_from_signatures(signatures, interval_seconds)

        return Response(data)

