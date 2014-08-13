import itertools

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import link, action
from rest_framework.reverse import reverse
from rest_framework.permissions import IsAuthenticated
from treeherder.model.derived import DatasetNotFoundError
from treeherder.webapp.api.utils import (UrlQueryFilter, with_jobs,
                                         oauth_required, get_option,
                                         to_timestamp, get_job_value_list,
                                         JOB_PROPERTY_RETURN_KEY)

PLATFORM_ORDER = {
    "linux32": 0,
    "linux64": 1,
    "osx-10-6": 2,
    "osx-10-8": 3,
    "osx-10-9": 4,
    "windowsxp": 5,
    "windows7-32": 6,
    "windows8-32": 7,
    "windows2012-64": 8,
    "android-2-2-armv6": 9,
    "android-2-2": 10,
    "android-2-3-armv6": 11,
    "android-2-3": 12,
    "android-4-0": 13,
    "android-4-2-x86": 14,
    "b2g-linux32": 15,
    "b2g-linux64": 16,
    "b2g-osx": 17,
    "b2g-win32": 18,
    "b2g-emu-ics": 19,
    "b2g-emu-jb": 20,
    "b2g-emu-kk": 21,
    "b2g-device-image" : 22,
    "mulet-linux32" : 23,
    "mulet-linux64" : 24,
    "mulet-osx": 25,
    "mulet-win32": 26,
    "other": 28
}

OPT_ORDER = {
    "opt": 0,
    "pgo": 1,
    "asan": 2,
    "debug": 3,
}

class ResultSetViewSet(viewsets.ViewSet):
    """
    View for ``resultset`` records

    ``result sets`` are synonymous with ``pushes`` in the ui
    """

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
        with_jobs = filter.pop('with_jobs', 'true').lower() == 'true'

        debug = request.QUERY_PARAMS.get('debug', None)

        objs = jm.get_result_set_list(
            offset_id,
            count,
            full,
            filter.conditions
            )

        if with_jobs:
            results = self.get_resultsets_with_jobs(
                jm, objs, full, {}, debug)
        else:

            for rs in objs:
                rs["revisions_uri"] = reverse("resultset-revisions",
                    kwargs={"project": jm.project, "pk": rs["id"]})

            results = objs

        meta['count'] = len(results)
        meta['repository'] = project

        resp = {
            'meta': meta,
            'results': results,
            }

        if with_jobs:
            resp['job_property_names'] = JOB_PROPERTY_RETURN_KEY

        return Response(resp)

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view of ``resultset``
        """
        filter = UrlQueryFilter({"id": pk})

        full = filter.pop('full', 'true').lower() == 'true'

        objs = jm.get_result_set_list(0, 1, full, filter.conditions)
        if objs:
            debug = request.QUERY_PARAMS.get('debug', None)
            rs = self.get_resultsets_with_jobs(jm, objs, full, {}, debug)
            return Response(rs[0])
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

    @link()
    @with_jobs
    def get_resultset_jobs(self, request, project, jm, pk=None):

        result_set_ids = request.QUERY_PARAMS.getlist('result_set_ids') or []
        debug = request.QUERY_PARAMS.get('debug', None)

        filter_params = request.QUERY_PARAMS.copy()

        # adapt the result_set_ids to the get_result_set_list
        # return structure
        objs = []
        map(lambda r_id:objs.append({'id':int(r_id)}), result_set_ids)

        results = self.get_resultsets_with_jobs(
                jm, objs, True, filter_params, debug, 'id')

        meta = {}
        meta['count'] = len(results)
        meta['repository'] = project

        return Response({
            'meta': meta,
            'results': results,
            'job_property_names': JOB_PROPERTY_RETURN_KEY
        })


    @staticmethod
    def get_resultsets_with_jobs(
        jm, rs_list, full, filter_kwargs, debug, sort_key='push_timestamp'):
        """Convert db result of resultsets in a list to JSON"""

        if 'result_set_ids' in filter_kwargs:
            del filter_kwargs['result_set_ids']

        rs_map = {}
        for rs in rs_list:
            rs_map[rs["id"]] = rs
            # all rs should have the revisions_uri, so add it here
            rs["revisions_uri"] = reverse("resultset-revisions",
                kwargs={"project": jm.project, "pk": rs["id"]})

        jobs_ungrouped = jm.get_result_set_job_list(
            rs_map.keys(),
            full,
            **filter_kwargs
        )

        option_collections = jm.refdata_model.get_all_option_collections()

        rs_grouper = lambda rsg: rsg["result_set_id"]
        # the main grouper for a result set is the combination of
        # platform and options
        platform_grouper = lambda pg: (
            PLATFORM_ORDER.get(pg["platform"], 100),
            OPT_ORDER.get(get_option(pg, option_collections), 100)
        )

        job_group_grouper = lambda jgg: jgg["job_group_symbol"]
        job_type_grouper = lambda jtg: jtg['job_type_symbol']

        rs_sorted = sorted(jobs_ungrouped, key=rs_grouper)
        resultsets = []
        for rs_id, resultset_group in itertools.groupby(rs_sorted, key=rs_grouper):

            resultset = rs_map[rs_id]
            resultsets.append(resultset)

            # we found jobs for this resultset, so remove it from the map
            # now that it's in the ``resultsets`` list.
            # after we are done with all these jobs, whatever is in the map are
            # resultsets with no jobs yet, which we add back in to the list
            # of resultsets to be returned.
            del(rs_map[rs_id])

            job_counts = dict.fromkeys(
                jm.RESULTS + jm.INCOMPLETE_STATES + ["total"], 0)

            #itertools needs the elements to be sorted by the grouper
            by_platform = sorted(list(resultset_group), key=platform_grouper)
            platforms = []
            for platform_group_name, platform_group in itertools.groupby(
                    by_platform,
                    key=platform_grouper):

                by_job_group = sorted(list(platform_group), key=job_group_grouper)

                platform_name = by_job_group[0]["platform"]
                platform_option = option_collections[
                    by_job_group[0]["option_collection_hash"]]['opt']

                groups = []
                for jg_symbol, jg_group in itertools.groupby(
                        by_job_group,
                        job_group_grouper):

                    by_job_type = sorted(list(jg_group), key=job_type_grouper)

                    job_list = []
                    groups.append({
                        "symbol": jg_symbol,
                        "name": by_job_type[0]["job_group_name"],
                        "jobs": job_list
                    })

                    # build the uri ref for each job
                    for job in by_job_type:

                        job_list.append(
                            get_job_value_list(
                                job, platform_option, jm.project, debug
                            )
                        )

                        if job["state"] == "completed":
                            job_counts[job["result"]] += 1
                        else:
                            job_counts[job["state"]] += 1
                        job_counts["total"] += 1

                platforms.append({
                    "name": platform_name,
                    "option": platform_option,
                    "groups": groups,
                })

            #the unique set of results that are contained in this resultset
            #can be used to determine the resultset's severity
            resultset.update({
                "platforms": platforms,
                "job_counts": job_counts,
            })

        # the resultsets left in the map have no jobs, so fill in the fields
        # with blanks that WOULD otherwise have been filled.
        for rs in rs_map.values():
            rs.update({
                "platforms": [],
                "job_counts": dict.fromkeys(
                    jm.RESULTS + jm.INCOMPLETE_STATES + ["total"], 0),
            })
            resultsets.append(rs)

        return sorted(
            resultsets,
            key=lambda x: x[sort_key],
            reverse=True)

    @action(permission_classes=[IsAuthenticated])
    @with_jobs
    def cancel_all(self, request, project, jm, pk=None):
        """
        Cancel all pending and running jobs in this resultset
        """

        if not pk:  # pragma nocover
            return Response({"message": "resultset id required"}, status=400)

        try:
            jm.cancel_all_resultset_jobs(pk)
            return Response({"message": "pending and running jobs canceled for resultset '{0}'".format(pk)})

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

