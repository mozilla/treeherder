# from django.conf.urls import url, include
from rest_framework import (filters,
                            serializers,
                            viewsets)

from treeherder.seta.models import JobPriority


class SetaJobPrioritySerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = JobPriority
        fields = ('testtype')


class SetaLowValueJobsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = JobPriority.objects.exclude(buildsystem='buildbot')
    serializer_class = SetaJobPrioritySerializer
