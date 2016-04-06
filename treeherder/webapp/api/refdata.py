import datetime

from django.contrib.auth.models import User
from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.model import models
from treeherder.model.derived import JobsModel
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


class RepositoryViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata Repository model"""
    queryset = models.Repository.objects.filter(active_status='active')
    serializer_class = th_serializers.RepositorySerializer

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
        search_term = request.query_params.get("search", None)
        if not search_term:
            return Response({"message": "the 'search' parameter is mandatory"}, status=400)

        max_size = 50
        # 90 days ago
        time_limit = datetime.datetime.now() - datetime.timedelta(days=90)
        # Wrap search term so it is used as a phrase in the full-text search.
        search_term_fulltext = search_term.join('""')
        # Substitute escape and wildcard characters, so the search term is used
        # literally in the LIKE statement.
        search_term_like = search_term.replace('=', '==').replace(
            '%', '=%').replace('_', '=_')
        recent = models.Bugscache.objects.raw(
            '''
            SELECT id, summary, crash_signature, keywords, os, resolution,
            MATCH (`summary`) AGAINST (%s IN BOOLEAN MODE) AS relevance
            FROM bugscache
            WHERE 1
              AND resolution = ''
              AND `summary` LIKE CONCAT ('%%%%', %s, '%%%%') ESCAPE '='
              AND modified >= %s
            ORDER BY relevance DESC
            LIMIT 0,%s
            ''', [search_term_fulltext, search_term_like, time_limit,
                  max_size])

        all_others = models.Bugscache.objects.raw(
            '''
            SELECT id, summary, crash_signature, keywords, os, resolution,
            MATCH (`summary`) AGAINST (%s IN BOOLEAN MODE) AS relevance
            FROM bugscache
            WHERE 1
            AND `summary` LIKE CONCAT ('%%%%', %s, '%%%%') ESCAPE '='
            AND (modified < %s OR resolution <> '')
            ORDER BY relevance DESC
            LIMIT 0,%s''', [search_term_fulltext, search_term_like, time_limit,
                            max_size])

        def _bug_dict(bug):
            return {
                'crash_signature': b.crash_signature,
                'resolution': b.resolution,
                'summary': b.summary,
                'keywords': b.keywords,
                'os': b.os,
                'id': b.id
            }
        return Response(dict(open_recent=[_bug_dict(b) for b in recent],
                             all_others=[_bug_dict(b) for b in all_others]))


class MachineViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata Machine model"""
    queryset = models.Machine.objects.all()
    serializer_class = th_serializers.MachineSerializer


class OptionCollectionHashViewSet(viewsets.ViewSet):

    """ViewSet for the virtual OptionCollectionHash model"""

    def list(self, request):
        option_collection_map = {}
        for (hash, option_name) in models.OptionCollection.objects.values_list(
                'option_collection_hash', 'option__name'):
            if not option_collection_map.get(hash):
                option_collection_map[hash] = [option_name]
            else:
                option_collection_map[hash].append(option_name)

        ret = []
        for (option_hash, option_names) in option_collection_map.iteritems():
            ret.append({'option_collection_hash': option_hash,
                        'options': [{'name': name} for
                                    name in option_names]})
        return Response(ret)


class JobTypeViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata JobType model"""
    queryset = models.JobType.objects.all()
    serializer_class = th_serializers.JobTypeSerializer


class FailureClassificationViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata FailureClassification model"""
    queryset = models.FailureClassification.objects.all()
    serializer_class = th_serializers.FailureClassificationSerializer

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
        if "author" not in request.data:
            request.data["author"] = request.user.id
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
        if "author" not in request.data:
            request.data["author"] = request.user.id
        return super(ExclusionProfileViewSet, self).create(request, *args, **kwargs)


class MatcherViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Matcher.objects.all()
    serializer_class = th_serializers.MatcherSerializer

    class Meta:
        model = models.Matcher
