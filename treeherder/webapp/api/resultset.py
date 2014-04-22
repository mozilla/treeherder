import itertools

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import link
from rest_framework.reverse import reverse
from treeherder.model.derived import DatasetNotFoundError
from treeherder.webapp.api.utils import (UrlQueryFilter, with_jobs,
                                         oauth_required, get_option,
                                         to_timestamp)


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
        count = min(filter.pop("count", 10), 1000)

        full = filter.pop('full', 'true').lower() == 'true'

        objs = jm.get_result_set_list(
            offset_id,
            count,
            full,
            filter.conditions
        )

        results = self.get_resultsets_with_jobs(jm, objs, full, {})
        meta['count'] = len(results)
        meta['repository'] = project

        return Response({
            'meta': meta,
            'results': results
        })

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view of ``resultset``
        """
        filter = UrlQueryFilter({"id": pk})

        full = filter.pop('full', 'true').lower() == 'true'

        objs = jm.get_result_set_list(0, 1, full, filter.conditions)
        if objs:
            rs = self.get_resultsets_with_jobs(jm, objs, full, {})
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

    @staticmethod
    def get_resultsets_with_jobs(jm, rs_list, full, filter_kwargs):
        """Convert db result of resultsets in a list to JSON"""

        # Fetch the job results all at once, then parse them out in memory.
        # organize the resultsets into an obj by key for lookups
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
        platform_grouper = lambda pg: "{0} {1}".format(
            pg["platform"],
            get_option(pg, option_collections)

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

                    groups.append({
                        "symbol": jg_symbol,
                        "name": by_job_type[0]["job_group_name"],
                        "jobs": by_job_type
                    })

                    # build the uri ref for each job
                    for job in by_job_type:
                        job["id"] = job["job_id"]
                        del(job["job_id"])
                        del(job["option_collection_hash"])

                        job["platform_option"] = platform_option
                        job["resource_uri"] = reverse("jobs-detail",
                            kwargs={"project": jm.project, "pk": job["id"]})

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
            key=lambda x: x["push_timestamp"],
            reverse=True)


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
