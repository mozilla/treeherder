from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, serializers

from treeherder.model.models import Bugscache, FailureLine

# Only track occurrences of a bug on a specific time window
BUGSCACHE_OCCURRENCES_WINDOW = timedelta(days=7)


class InternalIssueSerializer(serializers.Serializer):
    failure_line_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        source="failure_line",
        queryset=FailureLine.objects.all(),
    )
    occurrences = serializers.SerializerMethodField(read_only=True)

    def get_occurrences(self, bug):
        return bug.occurrences.filter(created__gte=timezone.now() - BUGSCACHE_OCCURRENCES_WINDOW)

    @transaction.atomic
    def create(self, validated_data):
        failure_line = validated_data["failure_line"]

        # TODO: Fetch all the similar failure lines
        similar_failure_lines = [failure_line.id]

        # Build or retrieve a bug already reported for a similar FailureLine
        bug = Bugscache.objects.filter(occurrences__failure_line__in=similar_failure_lines).first()
        if bug is None:
            # TODO: Support writting summary field from the FailureLine information
            bug = Bugscache.objects.create()

        bug.occurrences.get_or_create(
            user=self.context["request"].user,
            failure_line=failure_line,
            bug=bug,
        )
        return bug

    class Meta:
        model = Bugscache
        fields = ["failure_line_id", "occurrences"]


class CreateInternalIssue(generics.CreateAPIView):
    """
    Create a Bugscache entry, not necessarilly linked to a real Bugzilla ticket.
    In case it already exists, update its occurrences.

    Returns the number of occurrences of this bug in the last week.
    """

    serializer_class = InternalIssueSerializer
