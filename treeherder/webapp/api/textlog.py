import django_filters
from rest_framework import (filters,
                            viewsets)

from treeherder.model.models import (TextLogError,
                                     TextLogStep)
from treeherder.webapp.api import (pagination,
                                   serializers)


class TextLogErrorViewSet(viewsets.ModelViewSet):
    '''
    Endpoint for retrieving a list of errors associated with a job
    '''
    queryset = TextLogError.objects.all().select_related('job__guid',
                                                         'failure_line')
    serializer_class = serializers.TextLogErrorSerializer
    pagination_class = pagination.IdPagination

    class TextLogErrorFilter(filters.FilterSet):
        job_guid = django_filters.CharFilter(name='job__guid')

        class Meta:
            model = TextLogError
            fields = ['job_guid']

    filter_backends = [filters.DjangoFilterBackend]
    filter_class = TextLogErrorFilter


class TextLogStepViewSet(viewsets.ModelViewSet):
    '''
    Endpoint for retrieving a set of steps associated with a job
    '''
    queryset = TextLogStep.objects.all().select_related('job__guid').prefetch_related('errors')

    serializer_class = serializers.TextLogStepSerializer
    pagination_class = pagination.IdPagination

    class TextLogStepFilter(filters.FilterSet):
        job_guid = django_filters.CharFilter(name='job__guid')

        class Meta:
            model = TextLogStep
            fields = ['job_guid']

    filter_backends = [filters.DjangoFilterBackend]
    filter_class = TextLogStepFilter
