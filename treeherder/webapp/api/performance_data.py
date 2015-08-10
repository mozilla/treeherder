from django.core.cache import cache
from rest_framework import viewsets
from rest_framework.decorators import list_route
from rest_framework.response import Response
from rest_framework_extensions.etag.decorators import etag

from treeherder.model.derived.jobs import JobsModel
from treeherder.webapp.api.utils import with_jobs


class PerformanceDataViewSet(viewsets.ViewSet):

    """
    This view serves performance charts data
    """

    def _calculate_etag(view_instance, view_method,
                        request, args, kwargs):
        project, interval = (kwargs.get('project'),
                             request.QUERY_PARAMS.get('interval'))
        machine_platform = request.QUERY_PARAMS.get('machine_platform')
        if project and interval:
            return cache.get(JobsModel.get_performance_series_cache_key(
                project, interval, machine_platform, hash=True))

        return None

    @list_route()
    @etag(etag_func=_calculate_etag)
    @with_jobs
    def get_performance_series_summary(self, request, project, jm, pk=None):
        """
        GET method implementation for listing signatures

        Input: time interval, machine_platform
        Output: all series signatures and their properties
        """
        try:
            interval_seconds = int(request.QUERY_PARAMS.get('interval'))
            platform = request.QUERY_PARAMS.get('machine_platform')
        except:
            return Response("incorrect parameters", 400)

        summary = jm.get_performance_series_summary(interval_seconds, platform)
        return Response(summary)

    @list_route()
    @with_jobs
    def get_signatures_from_properties(self, request, project, jm, pk=None):
        """
        GET method implementation for signature data

        Input: property/value pairs
        Output: unique signatures
        """

        try:
            props = request.QUERY_PARAMS.dict()
        except Exception:
            return Response("incorrect parameters", 400)

        signatures = jm.get_signatures_from_properties(props)

        return Response(signatures)

    @list_route()
    @with_jobs
    def get_signature_properties(self, request, project, jm, pk=None):
        """
        GET method for signature

        Input: Signature SHA1's
        Output: List of signature properties
        """
        try:
            signatures = request.QUERY_PARAMS.getlist("signatures")
        except Exception:
            return Response("incorrect parameters", 400)

        if not signatures:
            return Response("no signatures provided", 400)

        data = jm.get_signature_properties(signatures)

        return Response(data)

    @list_route()
    @with_jobs
    def get_performance_data(self, request, project, jm, pk=None):
        """
        GET method implementation for performance data

        Input: list of series signatures
        Output: performance charting data
        """

        try:
            signatures = request.QUERY_PARAMS.getlist("signatures")
            interval = abs(int(request.QUERY_PARAMS.get("interval_seconds", 0)))
        except Exception:
            return Response("incorrect parameters", 400)

        if not signatures:
            return Response("no signatures provided", 400)

        data = jm.get_performance_series_from_signatures(signatures, interval)

        return Response(data)

    @list_route()
    @with_jobs
    def platforms(self, request, project, jm, pk=None):
        """
        Return list of platforms for which we have performance data

        Input: time interval
        Output: list of platforms
        """
        try:
            interval = int(request.QUERY_PARAMS.get('interval'))
        except:
            return Response("incorrect parameters", 400)

        platforms = jm.get_performance_platforms(interval)

        return Response(platforms)
