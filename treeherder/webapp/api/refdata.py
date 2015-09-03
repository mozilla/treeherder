from django.contrib.auth.models import User
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework_extensions.mixins import CacheResponseAndETAGMixin

from treeherder.model import models
from treeherder.model.derived import RefDataManager, JobsModel
from treeherder.webapp.api import serializers as th_serializers
from treeherder.webapp.api.permissions import (IsOwnerOrReadOnly,
                                               IsStaffOrReadOnly)

#####################
# Refdata ViewSets
#####################


class ProductViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata Product model"""
    queryset = models.Product.objects.all()
    serializer_class = th_serializers.ProductSerializer


class BuildPlatformViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata BuildPlatform model"""
    queryset = models.BuildPlatform.objects.all()
    serializer_class = th_serializers.BuildPlatformSerializer


class JobGroupViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata JobGroup model"""
    queryset = models.JobGroup.objects.all()
    serializer_class = th_serializers.JobGroupSerializer


class RepositoryViewSet(CacheResponseAndETAGMixin,
                        viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata Repository model"""
    queryset = models.Repository.objects.filter(active_status='active')
    serializer_class = th_serializers.RepositorySerializer

    def list_cache_key_func(self, **kwargs):
        return models.REPOSITORY_LIST_CACHE_KEY

    """
    Overrides the retrieve method to get the extra information from the Jobs model
    """
    def retrieve(self, request, *args, **kwargs):
        request = th_serializers.RepositorySerializer(self.queryset.get(pk=kwargs['pk']))
        new_request = request.data.copy()
        with JobsModel(request.data['name']) as jobs_model:
            new_request.update({'max_job_id': jobs_model.get_max_job_id()})

        return Response(new_request)


class MachinePlatformViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata MachinePlatform model"""
    queryset = models.MachinePlatform.objects.all()
    serializer_class = th_serializers.MachinePlatformSerializer


class BugscacheViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata Bugscache model"""
    queryset = models.Bugscache.objects.all()
    serializer_class = th_serializers.BugscacheSerializer

    def list(self, request):
        """
        Retrieves a list of bugs from the bugs cache
        search -- Mandatory term of search
        """
        search_term = request.QUERY_PARAMS.get("search", None)
        if not search_term:
            return Response({"message": "the 'search' parameter is mandatory"}, status=400)

        with RefDataManager() as rdm:
            return Response(rdm.get_bug_suggestions(search_term))


class MachineViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata Machine model"""
    queryset = models.Machine.objects.all()
    serializer_class = th_serializers.MachineSerializer


class OptionCollectionHashViewSet(viewsets.ViewSet):

    """ViewSet for the virtual OptionCollectionHash model"""

    def list(self, request):
        with RefDataManager() as rdm:
            option_collection_hash = rdm.get_all_option_collections()

        ret = []
        for (option_hash, val) in option_collection_hash.iteritems():
            ret.append({'option_collection_hash': option_hash,
                        'options': [{'name': name} for
                                    name in val['opt'].split()]})
        return Response(ret)


class JobTypeViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata JobType model"""
    queryset = models.JobType.objects.all()
    serializer_class = th_serializers.JobTypeSerializer


class FailureClassificationViewSet(CacheResponseAndETAGMixin,
                                   viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata FailureClassification model"""
    queryset = models.FailureClassification.objects.all()
    serializer_class = th_serializers.FailureClassificationSerializer

    def list_cache_key_func(self, **kwargs):
        return models.FAILURE_CLASSIFICAION_LIST_CACHE_KEY

#############################
# User and exclusion profiles
#############################


class UserViewSet(viewsets.ReadOnlyModelViewSet):

    """
    Info about a logged-in user.
    Used by Treeherder's UI to inspect user properties like the exclusion profile
    """
    serializer_class = th_serializers.UserSerializer

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)


class UserExclusionProfileViewSet(viewsets.ModelViewSet):
    queryset = models.UserExclusionProfile.objects.all()
    permission_classes = (IsOwnerOrReadOnly,)
    serializer_class = th_serializers.UserExclusionProfileSerializer


class JobExclusionViewSet(viewsets.ModelViewSet):
    queryset = models.JobExclusion.objects.all()
    permission_classes = (IsStaffOrReadOnly,)
    serializer_class = th_serializers.JobExclusionSerializer

    def create(self, request, *args, **kwargs):
        """
        Overrides the default Viewset to set the current user
        as the author of this filter
        """
        if "author" not in request.DATA:
            request.DATA["author"] = request.user.id
        return super(JobExclusionViewSet, self).create(request, *args, **kwargs)


class ExclusionProfileViewSet(viewsets.ModelViewSet):

    """

    """
    queryset = models.ExclusionProfile.objects.all()
    permission_classes = (IsStaffOrReadOnly,)
    serializer_class = th_serializers.ExclusionProfileSerializer

    def create(self, request, *args, **kwargs):
        """
        Overrides the default Viewset to set the current user
        as the author of this exclusion profile
        """
        if "author" not in request.DATA:
            request.DATA["author"] = request.user.id
        return super(ExclusionProfileViewSet, self).create(request, *args, **kwargs)
