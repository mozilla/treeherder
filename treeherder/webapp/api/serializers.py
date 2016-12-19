from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.reverse import reverse

from treeherder.model import models
from treeherder.webapp.api.utils import to_timestamp


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
    author = UserSerializer()

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
    author = UserSerializer()

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


class JobSerializer(serializers.ModelSerializer):

    def to_representation(self, job):
        return {
            'build_architecture': job.build_platform.architecture,
            'build_os': job.build_platform.os_name,
            'build_platform': job.build_platform.platform,
            'build_platform_id': job.build_platform_id,
            'build_system_type': job.signature.build_system_type,
            'end_timestamp': to_timestamp(job.end_time),
            'failure_classification_id': job.failure_classification_id,
            'id': job.project_specific_id,
            'job_coalesced_to_guid': job.coalesced_to_guid,
            'job_group_description': job.job_type.job_group.description,
            'job_group_id': job.job_type.job_group_id,
            'job_group_name': job.job_type.job_group.name,
            'job_group_symbol': job.job_type.job_group.symbol,
            'job_guid': job.guid,
            'job_type_description': job.job_type.description,
            'job_type_id': job.job_type_id,
            'job_type_name': job.job_type.name,
            'job_type_symbol': job.job_type.symbol,
            'last_modified': job.last_modified,
            'machine_name': job.machine.name,
            'machine_platform_architecture': job.machine_platform.architecture,
            'machine_platform_os': job.machine_platform.os_name,
            'option_collection_hash': job.option_collection_hash,
            'platform': job.machine_platform.platform,
            'push_id': job.push_id,
            'reason': job.reason,
            'ref_data_name': job.signature.name,
            'result': job.result,
            'result_set_id': job.push_id,
            'running_eta': job.running_eta,
            'signature': job.signature.signature,
            'start_timestamp': to_timestamp(job.start_time),
            'state': job.state,
            'submit_timestamp': to_timestamp(job.submit_time),
            'tier': job.tier,
            'who': job.who
        }

    class Meta:
        model = models.Job


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


class TextLogErrorSerializer(serializers.ModelSerializer):
    bug_suggestions = NoOpSerializer(read_only=True)

    class Meta:
        model = models.TextLogError
        exclude = ['step']


class TextLogStepSerializer(serializers.ModelSerializer):
    errors = TextLogErrorSerializer(many=True, read_only=True)
    result = serializers.SerializerMethodField()

    def get_result(self, obj):
        return obj.get_result_display()

    class Meta:
        model = models.TextLogStep
        exclude = ['job']


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


class JobNoteSerializer(serializers.ModelSerializer):

    # these custom fields are for backwards compatibility
    job_id = serializers.SlugRelatedField(
        slug_field="project_specific_id",
        source="job",
        read_only=True)
    failure_classification_id = serializers.SlugRelatedField(
        slug_field="id",
        source="failure_classification",
        read_only=True)

    class Meta:
        model = models.JobNote
        fields = ['id', 'job_id', 'failure_classification_id',
                  'created', 'who', 'text']


class CommitSerializer(serializers.ModelSerializer):

    result_set_id = serializers.PrimaryKeyRelatedField(
        source="push", read_only=True)
    repository_id = serializers.SlugRelatedField(
        slug_field="repository_id", source="push", read_only=True)

    class Meta:
        model = models.Commit
        fields = ['result_set_id', 'repository_id', 'revision', 'author',
                  'comments']


class PushSerializer(serializers.ModelSerializer):

    def get_revisions_uri(self, obj):
        return reverse("resultset-revisions",
                       kwargs={"project": obj.repository.name,
                               "pk": obj.id})

    def get_revisions(self, push):
        serializer = CommitSerializer(
            instance=push.commits.all().order_by('-id')[:20],
            many=True)
        return serializer.data

    def get_revision_count(self, push):
        return push.commits.count()

    def get_push_timestamp(self, push):
        return to_timestamp(push.time)

    revisions_uri = serializers.SerializerMethodField()
    revisions = serializers.SerializerMethodField()
    revision_count = serializers.SerializerMethodField()
    push_timestamp = serializers.SerializerMethodField()
    repository_id = serializers.PrimaryKeyRelatedField(
        source="repository", read_only=True)

    class Meta:
        model = models.Push
        fields = ['id', 'revision_hash', 'revision', 'author', 'revisions_uri',
                  'revisions', 'revision_count', 'push_timestamp',
                  'repository_id']
