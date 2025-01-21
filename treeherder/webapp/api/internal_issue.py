from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, serializers

from treeherder.model.models import Bugscache, FailureLine

# Only track occurences of a bug on a specific time window
BUGSCACHE_OCCURENCES_WINDOW = timedelta(days=7)


class InternalIssueSerializer(serializers.Serializer):
    failure_line_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        source="failure_line",
        queryset=FailureLine.objects.all(),
    )
    occurences = serializers.SerializerMethodField(read_only=True)

    def get_occurences(self, bug):
        return bug.occurences.filter(created__gte=timezone.now() - BUGSCACHE_OCCURENCES_WINDOW)

    @transaction.atomic
    def create(self, validated_data):
        failure_line = validated_data["failure_line"]

        # TODO: Fetch all the similar failure lines
        similar_failure_lines = [failure_line.id]

        # Build or retrieve a bug already reported for a similar FailureLine
        bug = Bugscache.objects.filter(occurences__failure_line__in=similar_failure_lines).first()
        if bug is None:
            # TODO: Support writting summary field from the FailureLine information
            bug = Bugscache.objects.create()

        bug.occurences.get_or_create(
            user=self.context["request"].user,
            failure_line=failure_line,
            bug=bug,
        )
        return bug

    class Meta:
        model = Bugscache
        fields = ["failure_line_id", "occurences"]


class InternalIssue(generics.CreateAPIView):
    """
    Create a Bugscache entry, not necessarilly linked to a real Bugzilla ticket.µ
    In case it already exists, update its occurences.

    Returns the number of occurences of this bug in the last week.
    """

    serializer_class = InternalIssueSerializer
