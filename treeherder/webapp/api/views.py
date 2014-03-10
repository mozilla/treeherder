import simplejson as json
import itertools
import oauth2 as oauth

from django.conf import settings
from rest_framework import viewsets, serializers
from rest_framework.response import Response
from rest_framework.decorators import action, link
from rest_framework.reverse import reverse
from rest_framework.exceptions import ParseError

from rest_framework.authentication import SessionAuthentication
from treeherder.webapp.api.permissions import IsStaffOrReadOnly

from treeherder.model import models
from treeherder.model.derived import (JobsModel, DatasetNotFoundError,
                                      RefDataManager, ObjectNotFoundException)

from treeherder.webapp.api.utils import UrlQueryFilter

from treeherder.etl.oauth_utils import OAuthCredentials


def oauth_required(func):

    def wrap_oauth(cls, *args, **kwargs):

        # First argument must be request object
        request = args[0]

        # Get the project keyword argumet
        project = kwargs.get('project', None)

        # Get the project credentials
        project_credentials = OAuthCredentials.get_credentials(project)

        if not project_credentials:
            msg = {
                'response': "invalid_request",
                'message': "project, {0}, has no OAuth credentials".format(project)
            }
            return Response(msg, 500)

        parameters = OAuthCredentials.get_parameters(request.QUERY_PARAMS)

        oauth_body_hash = parameters.get('oauth_body_hash', None)
        oauth_signature = parameters.get('oauth_signature', None)
        oauth_consumer_key = parameters.get('oauth_consumer_key', None)
        oauth_token = parameters.get('oauth_token', None)

        if not oauth_body_hash or not oauth_signature or not oauth_consumer_key:

            msg = {
                'response':"invalid_request",
                'message':"Required oauth parameters not provided in the uri"
                }

            return Response(msg, 500)

        if oauth_consumer_key != project_credentials['consumer_key']:
            msg = {
                'response':"access_denied",
                'message':"oauth_consumer_key does not match project, {0}, credentials".format(project)
                }

            return Response(msg, 403)

        uri = '{0}://{1}{2}'.format(
            settings.TREEHERDER_REQUEST_PROTOCOL, request.get_host(),
            request.path
            )

        #Construct the OAuth request based on the django request object
        req_obj = oauth.Request(
            method=request.method,
            url=uri,
            parameters=parameters,
            body=json.dumps(request.DATA),
            )

        server = oauth.Server()
        token = oauth.Token(key='', secret='')

        #Get the consumer object
        cons_obj = oauth.Consumer(
            oauth_consumer_key,
            project_credentials['consumer_secret']
            )

        #Set the signature method
        server.add_signature_method(oauth.SignatureMethod_HMAC_SHA1())

        try:
            #verify oauth django request and consumer object match
            server.verify_request(req_obj, cons_obj, token)
        except oauth.Error:
            msg = {
                'response':"invalid_client",
                'message':"Client authentication failed for project, {0}".format(project)
                }

            return Response(msg, 403)

        return func(request, *args, **kwargs)

    return wrap_oauth

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
            msg = {"message": unicode(e)}
            if settings.DEBUG:
                import traceback
                msg["traceback"] = traceback.format_exc()

            return Response(msg, status=500)
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
    @oauth_required
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        job_errors_resp = jm.store_job_data(request.DATA)

        resp = {}
        if job_errors_resp:
            resp['message'] = job_errors_resp
            status = 500
        else:
            status = 200
            resp['message'] = 'well-formed JSON stored'

        return Response(resp, status=status)

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for detail view
        """
        obj = jm.get_json_blob_by_guid(pk)
        if obj:
            return Response(json.loads(obj[0]['json_blob']))
        else:
            return Response("No objectstore entry with guid: {0}".format(pk), 404)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        """
        offset = int(request.QUERY_PARAMS.get('offset', 0))
        count = int(request.QUERY_PARAMS.get('count', 10))
        objs = jm.get_json_blob_list(offset, count)
        return Response([json.loads(obj['json_blob']) for obj in objs])


class ArtifactViewSet(viewsets.ViewSet):
    """
    This viewset is responsible for the artifact endpoint.
    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        retrieve a single instance of job_artifact
        """
        filter = UrlQueryFilter({"id": pk})

        objs = jm.get_job_artifact_list(0, 1, filter.conditions)
        if objs:
            return Response(objs[0])
        else:
            return Response("job_artifact {0} not found".format(pk), 404)

    @with_jobs
    def list(self, request, project, jm):
        """
        return a list of job artifacts
        """
        filter = UrlQueryFilter(request.QUERY_PARAMS)

        offset = filter.pop("offset", 0)
        count = filter.pop("count", 10)

        objs = jm.get_job_artifact_list(offset, count, filter.conditions)
        return Response(objs)

    @with_jobs
    @oauth_required
    def create(self, request, project, jm):
        artifact_data = []

        job_guids = [x['job_guid'] for x in request.DATA]
        job_id_lookup = jm.get_job_ids_by_guid(job_guids)

        for datum in request.DATA:
            artifact_data.append((
                job_id_lookup[datum['job_guid']]['id'],
                datum['name'],
                datum['type'],
                datum['blob']
            ))

        jm.store_job_artifact(artifact_data)
        return Response({'message': 'Artifacts stored successfully'})


class NoteViewSet(viewsets.ViewSet):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsStaffOrReadOnly,)

    """
    This viewset is responsible for the note endpoint.
    """
    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        GET method implementation for an artifact blob

        """
        obj = jm.get_job_note(pk)
        if obj:
            return Response(obj[0])
        else:
            return Response("No note with id: {0}".format(pk), 404)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view
        """
        job_id = request.QUERY_PARAMS.get('job_id')

        objs = jm.get_job_note_list(job_id=job_id)
        return Response(objs)

    @with_jobs
    def create(self, request, project, jm):
        """
        POST method implementation
        """
        jm.insert_job_note(
            request.DATA['job_id'],
            request.DATA['failure_classification_id'],
            request.DATA['who'],
            request.DATA.get('note', '')
        )
        return Response(
            {'message': 'note stored for job {0}'.format(
                request.DATA['job_id']
            )}
        )

def get_option(obj, option_collections):
    """Get the option, if there is one.  Otherwise, return None."""
    opt = obj.get("option_collection_hash", None)
    if (opt):
        return option_collections[opt]['opt']
    else:
        return None


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
        obj = jm.get_job(pk)
        if obj:
            job = obj[0]
            job["resource_uri"] = reverse("jobs-detail",
                kwargs={"project": jm.project, "pk": job["id"]})
            job["logs"] = jm.get_log_references(pk)

            # make artifact ids into uris
            artifact_refs = jm.get_job_artifact_references(pk)
            job["artifacts"] = []
            for art in artifact_refs:
                ref = reverse("artifact-detail",
                              kwargs={"project": jm.project, "pk": art["id"]})
                art["resource_uri"] = ref
                job["artifacts"].append(art)

            option_collections = jm.refdata_model.get_all_option_collections()
            job["platform_opt"] = get_option(job, option_collections)

            return Response(job)
        else:
            return Response("No job with id: {0}".format(pk), 404)

    @with_jobs
    def list(self, request, project, jm):
        """
        GET method implementation for list view

        """
        filter = UrlQueryFilter(request.QUERY_PARAMS)

        offset = filter.pop("offset", 0)
        count = filter.pop("count", 10)

        full = filter.pop('full', 'true').lower() == 'true'
        objs = jm.get_job_list(offset, count, full, filter.conditions)

        if objs:
            option_collections = jm.refdata_model.get_all_option_collections()
            for job in objs:
                job["platform_opt"] = get_option(job, option_collections)

        return Response(objs)

    @action()
    @with_jobs
    @oauth_required
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

        obj = jm.get_job(pk)
        if obj:
            jm.set_state(pk, state)
            return Response({"message": "state updated to '{0}'".format(state)})
        else:
            return Response("No job with id: {0}".format(pk), 404)

    @with_jobs
    @oauth_required
    def create(self, request, project, jm):
        """
        This method adds a job to a given resultset.
        The incoming data has the same structure as for
        the objectstore ingestion.
        """
        jm.load_job_data(request.DATA)

        return Response({'message': 'Job successfully updated'})


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

        filter = UrlQueryFilter(request.QUERY_PARAMS)

        offset = filter.pop("offset", 0)
        count = filter.pop("count", 10)
        full = filter.pop('full', 'true').lower() == 'true'

        objs = jm.get_result_set_list(
            offset,
            count,
            full,
            filter.conditions
        )
        return Response(self.get_resultsets_with_jobs(jm, objs, full, {}))

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
                        del(job["result_set_id"])
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


class RevisionLookupSetViewSet(viewsets.ViewSet):

    @with_jobs
    def list(self, request, project, jm):

        revision_filter = request.QUERY_PARAMS.get('revision', None)
        if not revision_filter:
            raise ParseError(detail="The revision parameter is mandatory for this endpoint")

        revision_list = revision_filter.split(",")

        return Response(jm.get_revision_resultset_lookup(revision_list))


class BugJobMapViewSet(viewsets.ViewSet):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsStaffOrReadOnly,)

    @with_jobs
    def create(self, request, project, jm):
        """
        Add a new relation between a job and a bug
        """
        job_id, bug_id = map(int, (request.DATA['job_id'],
                             request.DATA['bug_id']))

        jm.insert_bug_job_map(job_id, bug_id,
                              request.DATA['type'])

        return Response({"message": "Bug job map stored"})

    @with_jobs
    def destroy(self, request, project, jm, pk=None):
        """
        Delete bug-job-map entry. pk is a composite key in the form
        bug_id-job_id
        """
        job_id, bug_id = map(int, pk.split("-"))
        jm.delete_bug_job_map(job_id, bug_id)
        return Response({"message": "Bug job map deleted"})

    @with_jobs
    def retrieve(self, request, project, jm, pk=None):
        """
        Retrieve a bug-job-map entry. pk is a composite key in the form
        bug_id-job_id
        """
        job_id, bug_id = map(int, pk.split("-"))
        params = {
            "bug_id": bug_id,
            "job_id": job_id
        }
        params.update(request.QUERY_PARAMS)
        filter = UrlQueryFilter(params)
        obj = jm.get_bug_job_map_list(0, 1, filter.conditions)
        if obj:
            return Response(obj[0])
        else:
            return Response("Object not found", 404)



    @with_jobs
    def list(self, request, project, jm):
        filter = UrlQueryFilter(request.QUERY_PARAMS)

        offset = filter.pop("offset", 0)
        count = filter.pop("count", 10)

        objs = jm.get_bug_job_map_list(
            offset,
            count,
            filter.conditions
        )
        return Response(objs)


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


class RepositoryGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.RepositoryGroup
        fields = ('name', 'description')

class RepositorySerializer(serializers.ModelSerializer):
    repository_group = RepositoryGroupSerializer()

    class Meta:
        model = models.Repository

class RepositoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata Repository model"""
    model = models.Repository
    serializer_class = RepositorySerializer


class MachinePlatformViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata MachinePlatform model"""
    model = models.MachinePlatform


class BugscacheViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata Bugscache model"""
    model = models.Bugscache

    def list(self, request):
        """
        Retrieves a list of bugs from the bugs cache

        search -- Mandatory term of search
        status -- Optional filter on the status. Can be 'open' or 'closed'. Open by default
        """
        search_term = request.QUERY_PARAMS.get("search", None)
        if not search_term:
            return Response({"message": "the 'search' parameter is mandatory"}, status=400)

        status = request.QUERY_PARAMS.get("status", "open")
        if not status in ("open", "closed"):
            return Response({"message": "status must be 'open' or 'closed'"}, status=400)

        open_only = True if status == "open" else False

        rdm = RefDataManager()
        return Response(rdm.get_suggested_bugs(search_term, open_only))





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
