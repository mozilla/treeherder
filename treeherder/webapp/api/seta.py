# from django.conf.urls import url, include
from rest_framework import (filters,
                            serializers,
                            viewsets)

from treeherder.seta.models import JobPriority


class SetaHighValueSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = JobPriority
        fields = ['id', 'testtype', 'buildtype', 'platform', 'priority',
                  'timeout', 'expires', 'buildsystem']


class SetaHighValueJobsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = JobPriority.objects.all()
    serializer_class = SetaHighValueSerializer
    filter_backends = (filters.DjangoFilterBackend, filters.OrderingFilter)
    filter_fields = ['testtype']
