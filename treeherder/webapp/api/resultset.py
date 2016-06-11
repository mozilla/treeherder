import newrelic.agent
from rest_framework import viewsets
from rest_framework.decorators import detail_route
from rest_framework.exceptions import ParseError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.status import (HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)

from treeherder.model.tasks import publish_resultset_runnable_job_action
from treeherder.webapp.api import permissions
from treeherder.webapp.api.utils import (UrlQueryFilter,
                                         to_timestamp,
                                         with_jobs)


class ResultSetViewSet(viewsets.ViewSet):

    """
    View for ``resultset`` records

    ``result sets`` are synonymous with ``pushes`` in the ui
    """
    throttle_scope = 'resultset'
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method for list of ``resultset`` records with revisions

        """
        # What is the upper limit on the number of resultsets returned by the api
        MAX_RESULTS_COUNT = 1000

        # make a mutable copy of these params
        filter_params = request.query_params.copy()

        # This will contain some meta data about the request and results
        meta = {}

        # support ranges for date as well as revisions(changes) like old tbpl
        for param in ["fromchange", "tochange", "startdate", "enddate", "revision"]:
            v = filter_params.get(param, None)
            if v:
                del(filter_params[param])
                meta[param] = v

        # create a timestamp lookup based on the from/to change params that may
        # exist. This means we only make 1 DB query rather than 2, if we have
        # both a ``fromchange`` and a ``tochange`` value.
        ts_lookup = jm.get_resultset_all_revision_lookup(
            [meta[x] for x in ['fromchange', 'tochange'] if x in meta]
        )

        # translate these params into our own filtering mechanism
        if 'fromchange' in meta:
            filter_params.update({
                "push_timestamp__gte": ts_lookup[meta['fromchange']]["push_timestamp"]

            })
        if 'tochange' in meta:
            filter_params.update({
                "push_timestamp__lte": ts_lookup[meta['tochange']]["push_timestamp"]
            })
        if 'startdate' in meta:
            filter_params.update({
                "push_timestamp__gte": to_timestamp(meta['startdate'])
            })
        if 'enddate' in meta:

            # add a day because we aren't supplying a time, just a date.  So
            # we're doing ``less than``, rather than ``less than or equal to``.
            filter_params.update({
                "push_timestamp__lt": to_timestamp(meta['enddate']) + 86400
            })
        if 'revision' in meta:
            # Allow the user to search by either the short or long version of
            # a revision.
            rev_key = "revisions_long_revision" \
                if len(meta['revision']) == 40 else "revisions_short_revision"
            filter_params.update({rev_key: meta['revision']})

        meta['filter_params'] = filter_params

        filter = UrlQueryFilter(filter_params)

        offset_id = int(filter.pop("id__lt", 0))
        count = int(filter.pop("count", 10))

        if count > MAX_RESULTS_COUNT:
            msg = "Specified count exceeds api limit: {}".format(MAX_RESULTS_COUNT)
            return Response({"error": msg}, status=HTTP_400_BAD_REQUEST)

        full = filter.pop('full', 'true').lower() == 'true'

        results = jm.get_result_set_list(
            offset_id,
            count,
            full,
            filter.conditions
        )

        for rs in results:
            rs["revisions_uri"] = reverse("resultset-revisions",
                                          kwargs={"project": jm.project, "pk": rs["id"]})

        meta['count'] = len(results)
        meta['repository'] = project

        resp = {
            'meta': meta,
            'results': results
        }

        return Response(resp)

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view of ``resultset``
        """
        filter = UrlQueryFilter({"id": pk})

        full = filter.pop('full', 'true').lower() == 'true'

        result_set_list = jm.get_result_set_list(0, 1, full, filter.conditions)
        if result_set_list:
            return Response(result_set_list[0])
        return Response("No resultset with id: {0}".format(pk), status=HTTP_404_NOT_FOUND)

    @detail_route()
    @with_jobs
    def revisions(self, request, project, jm, pk=None):
        """
        GET method for revisions of a resultset
        """
        objs = jm.get_resultset_revisions_list(pk)
        return Response(objs)

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def cancel_all(self, request, project, jm, pk=None):
        """
        Cancel all pending and running jobs in this resultset
        """

        if not pk:  # pragma nocover
            return Response({"message": "resultset id required"}, status=HTTP_400_BAD_REQUEST)

        try:
            jm.cancel_all_resultset_jobs(request.user.email, pk)
            return Response({"message": "pending and running jobs canceled for resultset '{0}'".format(pk)})

        except Exception as ex:
            return Response("Exception: {0}".format(ex), status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def trigger_missing_jobs(self, request, project, jm, pk=None):
        """
        Trigger jobs that are missing in a resultset.
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=HTTP_400_BAD_REQUEST)

        try:
            jm.trigger_missing_resultset_jobs(request.user.email, pk, project)
            return Response({"message": "Missing jobs triggered for push '{0}'".format(pk)})

        except Exception as ex:
            return Response("Exception: {0}".format(ex), status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def trigger_all_talos_jobs(self, request, project, jm, pk=None):
        """
        Trigger all the talos jobs in a resultset.
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=HTTP_400_BAD_REQUEST)

        times = int(request.query_params.get('times', None))
        if not times:
            raise ParseError(detail="The 'times' parameter is mandatory for this endpoint")

        try:
            jm.trigger_all_talos_jobs(request.user.email, pk, project, times)
            return Response({"message": "Talos jobs triggered for push '{0}'".format(pk)})

        except Exception as ex:
            return Response("Exception: {0}".format(ex), status=HTTP_404_NOT_FOUND)

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def trigger_runnable_jobs(self, request, project, jm, pk=None):
        """
        Add new jobs to a resultset.
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=HTTP_400_BAD_REQUEST)

        # Making sure a resultset with this id exists
        filter = UrlQueryFilter({"id": pk})
        full = filter.pop('full', 'true').lower() == 'true'
        result_set_list = jm.get_result_set_list(0, 1, full, filter.conditions)
        if not result_set_list:
            return Response({"message": "No resultset with id: {0}".format(pk)},
                            status=HTTP_404_NOT_FOUND)

        buildernames = request.data.get('buildernames', [])
        decisionTaskID = request.data.get('decisionTaskID', [])
        if len(buildernames) == 0:
            Response({"message": "The list of buildernames cannot be empty"},
                     status=HTTP_400_BAD_REQUEST)

        publish_resultset_runnable_job_action.apply_async(
            args=[project, pk, request.user.email, buildernames, decisionTaskID],
            routing_key='publish_to_pulse'
        )

        return Response({"message": "New jobs added for push '{0}'".format(pk)})

    @with_jobs
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        # check if any revisions are shorter than the expected 40 characters
        # The volume of resultsets is fairly low, so this loop won't be
        # onerous.
        for resultset in request.data:
            for revision in resultset['revisions']:
                try:
                    if len(revision['revision']) < 40:
                        raise ValueError("Revision < 40 characters")
                except ValueError:
                    # The id of the submitter will be automatically included
                    # in the params via the ``hawk_lookup`` call
                    params = {
                        "revision": revision["revision"]
                    }
                    newrelic.agent.record_exception(params=params)

        stored_resultsets = jm.store_result_set_data(request.data)

        return Response({"message": "well-formed JSON stored",
                         "resultsets": stored_resultsets["result_set_ids"].values()})

    @detail_route()
    @with_jobs
    def status(self, request, project, jm, pk=None):
        """
        Return a count of the jobs belonging to this resultset
        grouped by job status.
        """
        return Response(jm.get_resultset_status(pk))
