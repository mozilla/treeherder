from rest_framework import viewsets
from rest_framework.decorators import detail_route
from rest_framework.exceptions import ParseError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.reverse import reverse

from treeherder.model.derived import DatasetNotFoundError
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
    permission_classes = (permissions.HasHawkOrLegacyOauthPermissionsOrReadOnly,)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method for list of ``resultset`` records with revisions

        """
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

        # translate these params into our own filtering mechanism
        if 'fromchange' in meta:
            filter_params.update({
                "push_timestamp__gte": jm.get_revision_timestamp(meta['fromchange'])
            })
        if 'tochange' in meta:
            filter_params.update({
                "push_timestamp__lte": jm.get_revision_timestamp(meta['tochange'])
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
            # TODO: modify to use ``short_revision`` or ``long_revision`` fields
            # when addressing Bug 1079796
            # It ends up that we store sometimes long, sometimes short
            # revisions in the ``revision`` field, depending on the repo/source.
            # (gaia, for instance).  So we must search
            # for EITHER the short or long, when long is passed in.
            if len(meta['revision']) > 12:
                filter_params.update(
                    {"revision__in": "{},{}".format(meta['revision'], meta['revision'][:12])}
                )
            else:
                filter_params.update({"revision": meta['revision']})

        meta['filter_params'] = filter_params

        filter = UrlQueryFilter(filter_params)

        offset_id = int(filter.pop("id__lt", 0))
        count = min(int(filter.pop("count", 10)), 1000)

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
        else:
            return Response("No resultset with id: {0}".format(pk), 404)

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
            return Response({"message": "resultset id required"}, status=400)

        try:
            jm.cancel_all_resultset_jobs(request.user.email, pk)
            return Response({"message": "pending and running jobs canceled for resultset '{0}'".format(pk)})

        except Exception as ex:
            return Response("Exception: {0}".format(ex), 404)

    @detail_route(methods=['post'], permission_classes=[permissions.IsStaffOrReadOnly])
    @with_jobs
    def trigger_missing_jobs(self, request, project, jm, pk=None):
        """
        Trigger jobs that are missing in a resultset.
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=400)

        try:
            jm.trigger_missing_resultset_jobs(request.user.email, pk, project)
            return Response({"message": "Missing jobs triggered for push '{0}'".format(pk)})

        except Exception as ex:
            return Response("Exception: {0}".format(ex), 404)

    @detail_route(methods=['post'], permission_classes=[permissions.IsStaffOrReadOnly])
    @with_jobs
    def trigger_all_talos_jobs(self, request, project, jm, pk=None):
        """
        Trigger all the talos jobs in a resultset.
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=400)

        times = int(request.query_params.get('times', None))
        if not times:
            raise ParseError(detail="The 'times' parameter is mandatory for this endpoint")

        try:
            jm.trigger_all_talos_jobs(request.user.email, pk, project, times)
            return Response({"message": "Talos jobs triggered for push '{0}'".format(pk)})

        except Exception as ex:
            return Response("Exception: {0}".format(ex), 404)

    @detail_route(methods=['post'], permission_classes=[IsAuthenticated])
    @with_jobs
    def trigger_runnable_jobs(self, request, project, jm, pk=None):
        """
        Add new jobs to a resultset.
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=400)

        # Making sure a resultset with this id exists
        filter = UrlQueryFilter({"id": pk})
        full = filter.pop('full', 'true').lower() == 'true'
        result_set_list = jm.get_result_set_list(0, 1, full, filter.conditions)
        if not result_set_list:
            return Response({"message": "No resultset with id: {0}".format(pk)},
                            status=404)

        buildernames = request.data.get('buildernames', [])
        if len(buildernames) == 0:
            Response({"message": "The list of buildernames cannot be empty"},
                     status=400)

        publish_resultset_runnable_job_action.apply_async(
            args=[project, pk, request.user.email, buildernames],
            routing_key='publish_to_pulse'
        )

        return Response({"message": "New jobs added for push '{0}'".format(pk)})

    @with_jobs
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        try:
            jm.store_result_set_data(request.data)
        except DatasetNotFoundError as e:
            return Response({"message": str(e)}, status=404)
        except Exception as e:  # pragma nocover
            import traceback
            traceback.print_exc()
            return Response({"message": str(e)}, status=500)
        finally:
            jm.disconnect()

        return Response({"message": "well-formed JSON stored"})

    @detail_route()
    @with_jobs
    def status(self, request, project, jm, pk=None):
        """
        Return a count of the jobs belonging to this resultset
        grouped by job status.
        """
        return Response(jm.get_resultset_status(pk))
