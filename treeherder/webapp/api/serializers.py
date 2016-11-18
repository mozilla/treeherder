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


class JobSerializer(serializers.ModelSerializer):

    class JobGroupNameField(serializers.RelatedField):
        def to_representation(self, value):
            return value.job_group.name

    class JobGroupDescriptionField(serializers.RelatedField):
        def to_representation(self, value):
            return value.job_group.description

    class JobGroupSymbolField(serializers.RelatedField):
        def to_representation(self, value):
            return value.job_group.symbol

    id = serializers.IntegerField(source='project_specific_id')
    build_architecture = serializers.SlugRelatedField(
        slug_field="architecture", source="build_platform", read_only=True)
    build_platform_id = serializers.IntegerField()
    build_platform = serializers.SlugRelatedField(
        slug_field="platform", read_only=True)
    build_os = serializers.SlugRelatedField(
        slug_field="os_name", read_only=True, source='build_platform')
    failure_classification_id = serializers.IntegerField()
    job_coalesced_to_guid = serializers.CharField(source='coalesced_to_guid')
    job_guid = serializers.CharField(source='guid')
    job_group_id = serializers.SlugRelatedField(
        slug_field="job_group_id", source="job_type", read_only=True)
    job_group_name = JobGroupNameField(read_only=True, source='job_type')
    job_group_symbol = JobGroupSymbolField(read_only=True, source='job_type')
    job_group_description = JobGroupDescriptionField(read_only=True,
                                                     source='job_type')
    job_type_name = serializers.SlugRelatedField(
        slug_field="name", source="job_type", read_only=True)
    job_type_description = serializers.SlugRelatedField(
        slug_field="description", source="job_type", read_only=True)
    job_type_symbol = serializers.SlugRelatedField(
        slug_field="symbol", source="job_type", read_only=True)
    job_type_id = serializers.IntegerField()
    machine_name = serializers.SlugRelatedField(slug_field="name",
                                                source="machine",
                                                read_only=True)

    platform = serializers.SlugRelatedField(
        slug_field="platform", source="machine_platform", read_only=True)

    machine_platform_architecture = serializers.SlugRelatedField(
        slug_field="architecture", source="machine_platform", read_only=True)
    machine_platform_os = serializers.SlugRelatedField(
        slug_field="os_name", source="machine_platform", read_only=True)

    ref_data_name = serializers.SlugRelatedField(
        slug_field="name", source="signature", read_only=True)
    build_system_type = serializers.SlugRelatedField(
        slug_field="build_system_type", source="signature", read_only=True)
    signature = serializers.SlugRelatedField(
        slug_field="signature", read_only=True)

    push_id = serializers.IntegerField()
    result_set_id = serializers.IntegerField(source="push_id")

    def get_submit_timestamp(self, job):
        return to_timestamp(job.submit_time)

    def get_start_timestamp(self, job):
        return to_timestamp(job.start_time)

    def get_end_timestamp(self, job):
        return to_timestamp(job.end_time)

    start_timestamp = serializers.SerializerMethodField()
    end_timestamp = serializers.SerializerMethodField()
    submit_timestamp = serializers.SerializerMethodField()

    class Meta:
        model = models.Job
        fields = ['id', 'job_guid',
                  'job_group_id', 'job_group_name', 'job_group_description',
                  'job_group_symbol',
                  'job_type_id', 'job_type_name', 'job_type_description',
                  'job_type_symbol',
                  'build_platform_id', 'build_architecture', 'build_platform',
                  'build_os',
                  'build_system_type',
                  'machine_platform_os', 'machine_platform_architecture',
                  'platform',
                  'option_collection_hash',
                  'machine_name',
                  'ref_data_name',
                  'result_set_id', 'push_id',
                  'result', 'reason', 'state', 'failure_classification_id',
                  'who', 'last_modified', 'running_eta', 'signature',
                  'tier', 'job_coalesced_to_guid',
                  'start_timestamp', 'end_timestamp', 'submit_timestamp']


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
