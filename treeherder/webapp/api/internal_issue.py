from rest_framework import generics

from treeherder.webapp.api.serializers import InternalIssueSerializer


class CreateInternalIssue(generics.CreateAPIView):
    """
    Create a Bugscache entry, not necessarilly linked to a real Bugzilla ticket.
    In case it already exists, update its occurrences.

    Returns the number of occurrences of this bug in the last week.
    """

    serializer_class = InternalIssueSerializer
