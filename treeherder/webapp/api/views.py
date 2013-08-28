import simplejson as json
import itertools

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.reverse import reverse
from treeherder.model import models

from treeherder.model.derived import (JobsModel, DatasetNotFoundError,
                                      ObjectNotFoundException)


def with_jobs(model_func):
    """
    Create a jobsmodel and pass it to the ``func``.

    ``func`` must take a jobsmodel object and return a response object

    Catches exceptions
    """
    def use_jobs_model(*args, **kwargs):
        project = kwargs["project"]
        try:
            jm = JobsModel(project)
            return model_func(*args, jm=jm, **kwargs)

        except DatasetNotFoundError as e:
            return Response(
                {"message": "No project with name {0}".format(project)},
                status=404,
            )
        except ObjectNotFoundException as e:
            return Response({"message": unicode(e)}, status=404)
        except Exception as e:  # pragma nocover
            return Response({"message": unicode(e)}, status=500)
        finally:
            jm.disconnect()

    return use_jobs_model


class ObjectstoreViewSet(viewsets.ViewSet):
    """
    This view is responsible for the objectstore endpoint.
    Only create, list and detail will be implemented.
    Update will not be implemented as JobModel will always do
    a conditional create and then an update.
    """

    @with_jobs
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        jm.store_job_data(
            json.dumps(request.DATA),
            request.DATA['job']['job_guid']
        )
        return Response({'message': 'well-formed JSON stored'})

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view
        """
        obj = jm.get_json_blob_by_guid(pk)
        return Response(json.loads(obj['json_blob']))

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        """
        page = int(request.QUERY_PARAMS.get('page', 0))
        objs = jm.get_json_blob_list(page, 10)
        return Response([json.loads(obj['json_blob']) for obj in objs])


class ArtifactViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the artifact endpoint.
    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for an artifact blob

        """
        obj = jm.get_job_artifact(pk)
        if obj["type"] == "json":
            obj["blob"] = json.loads(obj["blob"])
        return Response(obj)


class JobsViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the jobs endpoint.

    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view

        Return a single job with log_references and
        artifact names and links to the artifact blobs.
        """
        job = jm.get_job(pk)
        job["logs"] = jm.get_log_references(pk)

        # make artifact ids into uris
        artifact_refs = jm.get_job_artifact_references(pk)
        job["artifacts"] = []
        for art in artifact_refs:
            ref = reverse("artifact-detail",
                          kwargs={"project": jm.project, "pk": art["id"]})
            art["resource_uri"] = ref
            job["artifacts"].append(art)

        return Response(job)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        """
        page = request.QUERY_PARAMS.get('page', 0)

        objs = jm.get_job_list(page, 10)
        return Response(objs)

    @action()
    @with_jobs
    def update_state(self, request, project, jm, pk=None):
        """
        Change the state of a job.
        """
        state = request.DATA.get('state', None)

        # check that this state is valid
        if state not in jm.STATES:
            return Response(
                {"message": ("'{0}' is not a valid state.  Must be "
                             "one of: {1}".format(
                                 state,
                                 ", ".join(jm.STATES)
                             ))},
                status=400,
            )

        if not pk:  # pragma nocover
            return Response({"message": "job id required"}, status=400)

        jm.get_job(pk)
        jm.set_state(pk, state)

        return Response({"message": "state updated to '{0}'".format(state)})


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

        filters = ["author"]

        page = request.QUERY_PARAMS.get('page', 0)

        objs = jm.get_result_set_list(
            page,
            10,
            **dict((k, v) for k, v in request.QUERY_PARAMS.iteritems()
                   if k in filters)
        )
        return Response(objs)

    @classmethod
    def get_warning_level(cls, groups):
        """
        Return the most severe warning level for a list of jobs.

        A color-based warning level based on the most severe
        level in the list of jobs.

        @@@ - This needs a better way.
        """
        job_states = []
        for group in groups:
            job_states.extend([job["result"] for job in group["jobs"]])

        job_states = set(job_states)
        if "busted" in job_states:
            return "red"
        if "fail" in job_states:
            return "red"
        elif "testfailed" in job_states:
            return "red"
        elif "orange" in job_states:
            return "orange"
        elif "pending" in job_states:
            return "grey"
        elif "retry" in job_states:
            return "grey"
        elif "running" in job_states:
            return "grey"
        else:
            return "green"

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view of ``resultset``
        """
        filters = ["job_type_name"]

        rs = jm.get_result_set_by_id(pk)
        jobs_ungrouped = list(jm.get_result_set_job_list(
            pk,
            **dict((k, v) for k, v in request.QUERY_PARAMS.iteritems()
                   if k in filters)
        ))

        option_collections = dict(
            (oc['option_collection_hash'], oc['opt'])
            for oc in jm.refdata_model.get_all_option_collections())

        # the main grouper for a result set is the combination of
        # platform and options
        platform_grouper = lambda x: "{0} {1}".format(
            x["platform"],
            option_collections[x["option_collection_hash"]]
        )

        #itertools needs the elements to be sorted by the grouper
        jobs_sorted = sorted(jobs_ungrouped, key=platform_grouper)

        rs["platforms"] = []

        # job_groups by platform and options
        for k, g in itertools.groupby(jobs_sorted, key=platform_grouper):

            job_group_grouper = lambda x: x["job_group_symbol"]
            job_groups = sorted(list(g), key=job_group_grouper)
            groups = []
            for jg_k, jg_g in itertools.groupby(job_groups,
                                                job_group_grouper):

                jobs = sorted(list(jg_g),
                              key=lambda x: x['job_type_symbol'])

                groups.append({
                    "symbol": jg_k,
                    "name": jobs[0]["job_group_name"],
                    "jobs": jobs
                })

                # build the uri ref for each job
                for job in jobs:
                    job["resource_uri"] = reverse("jobs-detail",
                        kwargs={"project": jm.project, "pk": job["job_id"]})
                    del(job["job_group_name"])
                    del(job["job_group_symbol"])

            rs["platforms"].append({
                "name": k,
                "groups": groups,
                "warning_level": self.get_warning_level(groups)
            })

        return Response(rs)


#####################
# Refdata ViewSets
#####################

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata Product model"""
    model = models.Product


class BuildPlatformViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata BuildPlatform model"""
    model = models.BuildPlatform


class OptionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata Option model"""
    model = models.Option


class JobGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata JobGroup model"""
    model = models.JobGroup


class RepositoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata Repository model"""
    model = models.Repository


class MachinePlatformViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata MachinePlatform model"""
    model = models.MachinePlatform


class BugscacheViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata Bugscache model"""
    model = models.Bugscache


class MachineViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata Machine model"""
    model = models.Machine


class MachineNoteViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata MachineNote model"""
    model = models.MachineNote


class RepositoryVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata RepositoryVersion model"""
    model = models.RepositoryVersion


class OptionCollectionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata OptionCollection model"""
    model = models.OptionCollection


class JobTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata JobType model"""
    model = models.JobType


class FailureClassificationViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata FailureClassification model"""
    model = models.FailureClassification
