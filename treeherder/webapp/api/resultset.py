# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import link, action
from rest_framework.reverse import reverse
from rest_framework.permissions import IsAuthenticated
from treeherder.model.derived import DatasetNotFoundError
from treeherder.webapp.api.utils import (UrlQueryFilter, with_jobs,
                                         oauth_required,
                                         to_timestamp)


class ResultSetViewSet(viewsets.ViewSet):

    """
    View for ``resultset`` records

    ``result sets`` are synonymous with ``pushes`` in the ui
    """
    throttle_scope = 'resultset'

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method for list of ``resultset`` records with revisions

        """
        # make a mutable copy of these params
        filter_params = request.QUERY_PARAMS.copy()

        # This will contain some meta data about the request and results
        meta = {}

        # support ranges for date as well as revisions(changes) like old tbpl
        for param in ["fromchange", "tochange", "startdate", "enddate"]:
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

        meta['filter_params'] = filter_params

        filter = UrlQueryFilter(filter_params)

        offset_id = filter.pop("id__lt", 0)
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

    @link()
    @with_jobs
    def revisions(self, request, project, jm, pk=None):
        """
        GET method for revisions of a resultset
        """
        objs = jm.get_resultset_revisions_list(pk)
        return Response(objs)

    @action(permission_classes=[IsAuthenticated])
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

    @action(permission_classes=[IsAuthenticated])
    @with_jobs
    def fill_all(self, request, project, jm, pk=None):
        """
        Fill all the jobs in this resultset
        """
        if not pk:
            return Response({"message": "resultset id required"}, status=400)

        try:
            jm.fill_all_revision_jobs(request.user.email, pk, project)
            return Response({"message": "jobs triggered to be filled in for resultset '{0}' and branch '{1}'".format(pk, project)})

        except Exception as ex:
            return Response("Exception: {0}".format(ex), 404)

    @with_jobs
    @oauth_required
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        try:
            jm.store_result_set_data(request.DATA)
        except DatasetNotFoundError as e:
            return Response({"message": str(e)}, status=404)
        except Exception as e:  # pragma nocover
            import traceback
            traceback.print_exc()
            return Response({"message": str(e)}, status=500)
        finally:
            jm.disconnect()

        return Response({"message": "well-formed JSON stored"})

    @link()
    @with_jobs
    def status(self, request, project, jm, pk=None):
        """
        Return a count of the jobs belonging to this resultset
        grouped by job status.
        """
        return Response(jm.get_resultset_status(pk))
