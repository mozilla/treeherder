# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from rest_framework_extensions.mixins import CacheResponseAndETAGMixin

from django.contrib.auth.models import User

from treeherder.model import models
from treeherder.model.derived import RefDataManager
from treeherder.webapp.api import serializers as th_serializers
from treeherder.webapp.api.permissions import (IsStaffOrReadOnly,
                                               IsOwnerOrReadOnly)

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


class RepositoryViewSet(CacheResponseAndETAGMixin,
                        viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata Repository model"""
    serializer_class = th_serializers.RepositorySerializer
    queryset = models.Repository.objects.filter(active_status='active')

    def list_cache_key_func(self, **kwargs):
        return models.REPOSITORY_LIST_CACHE_KEY


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
        """
        search_term = request.QUERY_PARAMS.get("search", None)
        if not search_term:
            return Response({"message": "the 'search' parameter is mandatory"}, status=400)

        rdm = RefDataManager()
        try:
            suggested_bugs = rdm.get_bug_suggestions(search_term)
        finally:
            rdm.disconnect()
        return Response(suggested_bugs)


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


class OptionCollectionHashViewSet(viewsets.ViewSet):
    """ViewSet for the virtual OptionCollectionHash model"""

    def list(self, request):
        rdm = RefDataManager()
        try:
            option_collection_hash = rdm.get_all_option_collections()
        finally:
            rdm.disconnect()

        ret = []
        for (option_hash, val) in option_collection_hash.iteritems():
            ret.append({ 'option_collection_hash': option_hash,
                         'options': [{'name': name } for
                                     name in val['opt'].split()] })
        return Response(ret)

class JobTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata JobType model"""
    model = models.JobType


class FailureClassificationViewSet(CacheResponseAndETAGMixin,
                                   viewsets.ReadOnlyModelViewSet):
    """ViewSet for the refdata FailureClassification model"""
    model = models.FailureClassification

    def list_cache_key_func(self, **kwargs):
        return models.FAILURE_CLASSIFICAION_LIST_CACHE_KEY

#############################
# User and exclusion profiles
#############################


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Info about a logged-in user.
    Used by treeherder-ui to inspect user properties like the exclusion profile
    """
    model = User
    serializer_class = th_serializers.UserSerializer
    authentication_classes = (SessionAuthentication,)

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)


class UserExclusionProfileViewSet(viewsets.ModelViewSet):
    model = models.UserExclusionProfile
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsOwnerOrReadOnly,)
    serializer_class = th_serializers.UserExclusionProfileSerializer


class JobExclusionViewSet(viewsets.ModelViewSet):
    model = models.JobExclusion
    authentication_classes = (SessionAuthentication,)
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
    model = models.ExclusionProfile
    authentication_classes = (SessionAuthentication,)
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

    def post_save(self, obj, created=False):
        obj.update_flat_exclusions()
