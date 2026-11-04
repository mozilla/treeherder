from rest_framework import generics, permissions

from treeherder.webapp.api.serializers import InternalIssueSerializer


class CreateInternalIssue(generics.CreateAPIView):
    """
    Create a Bugscache entry, not necessarilly linked to a real Bugzilla ticket.
    In case it already exists, update its occurrences.

    Returns the number of occurrences of this bug in the last week.
    """

    serializer_class = InternalIssueSerializer
    permission_classes = [permissions.IsAuthenticated]
