from rest_framework import viewsets

from treeherder.model import models
from treeherder.webapp.api import serializers as th_serializers


class PulseStoreViewSet(viewsets.ReadOnlyModelViewSet):

    """ViewSet for the PulseStore model"""
    queryset = models.PulseStore.objects.all()
    serializer_class = th_serializers.PulseStoreSerializer
