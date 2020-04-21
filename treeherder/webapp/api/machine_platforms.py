from rest_framework import viewsets
from rest_framework.response import Response

from treeherder.model.models import MachinePlatform

from .serializers import MachinePlatformSerializer


class MachinePlatformsViewSet(viewsets.ViewSet):
    """
        A ViewSet for listing all the machine platforms.
    """

    def list(self, request):
        platforms = MachinePlatform.objects.all()
        platforms_serializer = MachinePlatformSerializer(platforms, many=True)
        return Response(platforms_serializer.data)
