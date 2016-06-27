from django.contrib.auth.models import User
from rest_framework import serializers

from treeherder.model import models


class NoOpSerializer(serializers.Serializer):
    """
    This serializer is necessary because we are using JSONField.
    The json renderers/parsers already take care of the serialization/deserialization of the objects
    to/from json, so we need a field serializer for those fields that just return the input.
    """

    def to_internal_value(self, data):
        return data

    def to_representation(self, value):
        return value


class UserExclusionProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.UserExclusionProfile
        fields = ["is_default", "exclusion_profile"]


class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = ["username", "is_superuser", "is_staff", "email", "exclusion_profiles"]


class JobExclusionSerializer(serializers.ModelSerializer):
    info = NoOpSerializer()

    class Meta:
        model = models.JobExclusion

    # We need to override .create and .update because ModelSerializer raises an error
    # if it finds nested resources. A JSONField instance is either a dict or a list
    # which makes it look like a nested relationship.
    def create(self, validated_data):
        instance = models.JobExclusion.objects.create(**validated_data)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance


class ExclusionProfileSerializer(serializers.ModelSerializer):
    flat_exclusion = NoOpSerializer(read_only=True)

    class Meta:
        model = models.ExclusionProfile


class RepositoryGroupSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.RepositoryGroup
        fields = ('name', 'description')


class RepositorySerializer(serializers.ModelSerializer):
    repository_group = RepositoryGroupSerializer()

    class Meta:
        model = models.Repository


class ProductSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.Product


class BuildPlatformSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.BuildPlatform


class MachinePlatformSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.MachinePlatform


class JobGroupSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.JobGroup


class JobTypeSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.JobType


class MachineSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.Machine


class FailureClassificationSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.FailureClassification


class BugscacheSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.Bugscache


class MatcherSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.Matcher


class ClassifiedFailureSerializer(serializers.ModelSerializer):
    bug = BugscacheSerializer(read_only=True)

    class Meta:
        model = models.ClassifiedFailure
        exclude = ['failure_lines', 'created', 'modified']


class FailureMatchSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.FailureMatch
        exclude = ['failure_line']


class FailureLineNoStackSerializer(serializers.ModelSerializer):
    matches = FailureMatchSerializer(many=True)
    classified_failures = ClassifiedFailureSerializer(many=True)
    unstructured_bugs = NoOpSerializer(read_only=True)

    class Meta:
        model = models.FailureLine
        exclude = ['stack',
                   'stackwalk_stdout',
                   'stackwalk_stderr']


class TextLogSummaryLineSerializer(serializers.ModelSerializer):
    bug = BugscacheSerializer(read_only=True)

    class Meta:
        model = models.TextLogSummaryLine


class TextLogSummarySerializer(serializers.ModelSerializer):
    lines = TextLogSummaryLineSerializer(many=True)

    class Meta:
        model = models.TextLogSummary


class JobDetailSerializer(serializers.ModelSerializer):

    job_guid = serializers.SlugRelatedField(
        slug_field="guid", source="job",
        queryset=models.Job.objects.all())
    job_id = serializers.SlugRelatedField(
        slug_field="project_specific_id", source="job",
        queryset=models.Job.objects.all())

    class Meta:
        model = models.JobDetail
        fields = ['job_id', 'job_guid', 'title', 'value', 'url']


class BugJobMapSerializer(serializers.ModelSerializer):

    job_id = serializers.SlugRelatedField(
        slug_field="project_specific_id",
        source="job",
        read_only=True)

    class Meta:
        model = models.BugJobMap
        fields = ['job_id', 'bug_id', 'created', 'who']
