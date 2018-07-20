from django.contrib.auth.models import User
from rest_framework import viewsets
from rest_framework.response import Response
from six import iteritems

from treeherder.model import models
from treeherder.webapp.api import serializers as th_serializers

#####################
# Refdata ViewSets
#####################


class RepositoryViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata Repository model"""
    queryset = models.Repository.objects.filter(
        active_status='active').select_related(
            'repository_group')
    serializer_class = th_serializers.RepositorySerializer


class OptionCollectionHashViewSet(viewsets.ViewSet):

    """ViewSet for the virtual OptionCollectionHash model"""

    def list(self, request):
        option_collection_map = models.OptionCollection.objects.get_option_collection_map(options_as_list=True)

        ret = []
        for (option_hash, option_names) in iteritems(option_collection_map):
            ret.append({'option_collection_hash': option_hash,
                        'options': [{'name': name} for
                                    name in option_names]})
        return Response(ret)


class FailureClassificationViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the refdata FailureClassification model"""
    queryset = models.FailureClassification.objects.exclude(name="intermittent needs filing")
    serializer_class = th_serializers.FailureClassificationSerializer

#############################
# User profiles
#############################


class UserViewSet(viewsets.ReadOnlyModelViewSet):

    """
    Info about a logged-in user.
    Used by Treeherder's UI to inspect user properties
    """
    serializer_class = th_serializers.UserSerializer

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)


class MatcherViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Matcher.objects.all()
    serializer_class = th_serializers.MatcherSerializer

    class Meta:
        model = models.Matcher
