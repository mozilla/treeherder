import re

from django.contrib.auth.models import User
from rest_framework import serializers

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


class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = ["username", "is_superuser", "is_staff", "email"]


class RepositoryGroupSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.RepositoryGroup
        fields = ('name', 'description')


class RepositorySerializer(serializers.ModelSerializer):
    repository_group = RepositoryGroupSerializer()

    class Meta:
        model = models.Repository
        fields = '__all__'


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
            'id': job.id,
            'job_group_description': job.job_group.description,
            'job_group_id': job.job_group_id,
            'job_group_name': job.job_group.name,
            'job_group_symbol': job.job_group.symbol,
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
            'signature': job.signature.signature,
            'start_timestamp': to_timestamp(job.start_time),
            'state': job.state,
            'submit_timestamp': to_timestamp(job.submit_time),
            'tier': job.tier,
            'who': job.who
        }

    class Meta:
        model = models.Job
        fields = '__all__'


class FailureClassificationSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.FailureClassification
        fields = '__all__'


class BugscacheSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.Bugscache
        fields = '__all__'


class MatcherSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.Matcher
        fields = '__all__'


class ClassifiedFailureSerializer(serializers.ModelSerializer):
    bug = BugscacheSerializer(read_only=True)

    class Meta:
        model = models.ClassifiedFailure
        exclude = ['failure_lines', 'created', 'modified', 'text_log_errors']


class TextLogErrorMatchSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.TextLogErrorMatch
        exclude = ['text_log_error']


class FailureLineNoStackSerializer(serializers.ModelSerializer):
    matches = TextLogErrorMatchSerializer(many=True)
    classified_failures = ClassifiedFailureSerializer(many=True)
    unstructured_bugs = NoOpSerializer(read_only=True)

    class Meta:
        model = models.FailureLine
        exclude = ['stack',
                   'stackwalk_stdout',
                   'stackwalk_stderr']


class TextLogErrorMetadataSerializer(serializers.ModelSerializer):
    failure_line = FailureLineNoStackSerializer(read_only=True)

    class Meta:
        model = models.TextLogErrorMetadata
        fields = '__all__'


class TextLogErrorSerializer(serializers.ModelSerializer):
    matches = TextLogErrorMatchSerializer(many=True)
    classified_failures = ClassifiedFailureSerializer(many=True)
    bug_suggestions = NoOpSerializer(read_only=True)
    metadata = TextLogErrorMetadataSerializer(read_only=True)

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


class JobDetailSerializer(serializers.ModelSerializer):

    job_id = serializers.PrimaryKeyRelatedField(
        source="job", read_only=True)

    job_guid = serializers.SlugRelatedField(
        slug_field="guid", source="job",
        queryset=models.Job.objects.all())

    class Meta:
        model = models.JobDetail
        fields = ['job_id', 'job_guid', 'title', 'value', 'url']


class BugJobMapSerializer(serializers.ModelSerializer):
    job_id = serializers.PrimaryKeyRelatedField(
        source="job", read_only=True)

    class Meta:
        model = models.BugJobMap
        fields = ['job_id', 'bug_id', 'created', 'who']


class JobNoteSerializer(serializers.ModelSerializer):

    job_id = serializers.PrimaryKeyRelatedField(
        source="job", read_only=True)

    # these custom fields are for backwards compatibility
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

    def get_revisions(self, push):
        serializer = CommitSerializer(
            instance=push.commits.all().order_by('-id')[:20],
            many=True)
        return serializer.data

    def get_revision_count(self, push):
        return push.commits.count()

    def get_push_timestamp(self, push):
        return to_timestamp(push.time)

    revisions = serializers.SerializerMethodField()
    revision_count = serializers.SerializerMethodField()
    push_timestamp = serializers.SerializerMethodField()
    repository_id = serializers.PrimaryKeyRelatedField(
        source="repository", read_only=True)

    class Meta:
        model = models.Push
        fields = ['id', 'revision', 'author',
                  'revisions', 'revision_count', 'push_timestamp',
                  'repository_id']


class FailuresSerializer(serializers.ModelSerializer):
    bug_count = serializers.IntegerField()

    class Meta:
        model = models.BugJobMap
        fields = ('bug_id', 'bug_count')


class TestSuiteField(serializers.Field):
    """Removes all characters before /"""
    def to_representation(self, field_value):
        return re.sub(r'.+/', '', field_value)


class FailuresByBugSerializer(serializers.ModelSerializer):
    test_suite = TestSuiteField(source="job__signature__job_type_name")
    platform = serializers.CharField(source="job__machine_platform__platform")
    revision = serializers.CharField(source="job__push__revision")
    tree = serializers.CharField(source="job__repository__name")
    push_time = serializers.CharField(source="job__push__time")
    build_type = serializers.CharField()
    machine_name = serializers.CharField(source="job__machine__name")

    class Meta:
        model = models.BugJobMap
        fields = ('push_time', 'platform', 'revision', 'test_suite', 'tree', 'build_type', 'job_id', 'bug_id', 'machine_name')


class FailureCountSerializer(serializers.ModelSerializer):
    test_runs = serializers.IntegerField()
    date = serializers.DateField(format="%Y-%m-%d")
    failure_count = serializers.IntegerField()

    class Meta:
        model = models.Push
        fields = ('date', 'test_runs', 'failure_count')
