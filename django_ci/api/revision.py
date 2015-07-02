from django_ci.models import Revision
from django_ci.api import RevisionSerializer, CreateListRetrieveViewSet


class RevisionViewSet(CreateListRetrieveViewSet):
    """
    A viewset to create and read revisions
    """
    queryset = Revision.objects.all()
    serializer_class = RevisionSerializer
