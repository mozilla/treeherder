from django_ci.models import ResultSet
from django_ci.api import ResultSetSerializer, CreateListRetrieveViewSet


class ResultSetViewSet(CreateListRetrieveViewSet):
    """
    A viewset to create and read result sets
    """
    queryset = ResultSet.objects.all()
    serializer_class = ResultSetSerializer
