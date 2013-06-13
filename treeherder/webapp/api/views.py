import simplejson as json

from django.http import Http404
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import exceptions
from treeherder.model import models

from treeherder.model.derived import JobsModel, DatasetNotFoundError


class ObjectstoreViewSet(viewsets.ViewSet):
    """
    This view is responsible for the objectstore endpoint.
    Only create, list and detail will be implemented.
    Update will not be implemented as JobModel will always do
    a conditional create and then an update.
    """

    def create(self, request, project):
        """
        POST method implementation
        """
        try:
            jm = JobsModel(project)
            jm.store_job_data(
                json.dumps(request.DATA),
                request.DATA['job']['job_guid']
            )
            jm.disconnect()
        except Exception as e:
            return Response({"message": str(e)}, status=500)

        return Response({'message': 'well-formed JSON stored'})

    def retrieve(self, request, project, pk=None):
        """
        GET method implementation for detail view
        """
        jm = JobsModel(project)
        obj = jm.get_json_blob_by_guid(pk)
        if obj:
            return Response(json.loads(obj[0]['json_blob']))
        else:
            raise Http404()

    def list(self, request, project):
        """
        GET method implementation for list view
        """
        page = request.QUERY_PARAMS.get('page', 0)
        jm = JobsModel(project)
        objs = jm.get_json_blob_list(page, 10)
        return Response([json.loads(obj['json_blob']) for obj in objs])


#####################
# Refdata ViewSets
#####################

class ProductViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata Product model"""
    model = models.Product


class BuildPlatformViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata BuildPlatform model"""
    model = models.BuildPlatform


class OptionViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata Option model"""
    model = models.Option


class JobGroupViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata JobGroup model"""
    model = models.JobGroup


class RepositoryViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata Repository model"""
    model = models.Repository


class MachinePlatformViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata MachinePlatform model"""
    model = models.MachinePlatform


class BugscacheViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata Bugscache model"""
    model = models.Bugscache


class MachineViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata Machine model"""
    model = models.Machine


class MachineNoteViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata MachineNote model"""
    model = models.MachineNote


class RepositoryVersionViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata RepositoryVersion model"""
    model = models.RepositoryVersion


class OptionCollectionViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata OptionCollection model"""
    model = models.OptionCollection


class JobTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata JobType model"""
    model = models.JobType


class FailureClassificationViewSet(viewsets.ModelViewSet):
    """ViewSet for the refdata FailureClassification model"""
    model = models.FailureClassification
