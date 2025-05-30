import re

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from rest_framework import serializers

from treeherder.changelog.models import Changelog
from treeherder.model import models
from treeherder.webapp.api.utils import REPO_GROUPS, to_timestamp


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
        fields = ("name", "description")


class RepositorySerializer(serializers.ModelSerializer):
    repository_group = RepositoryGroupSerializer()

    class Meta:
        model = models.Repository
        fields = "__all__"


class TaskclusterMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TaskclusterMetadata
        fields = "__all__"


class JobProjectSerializer(serializers.ModelSerializer):
    def to_representation(self, job):
        return {
            "build_architecture": job.build_platform.architecture,
            "build_os": job.build_platform.os_name,
            "build_platform": job.build_platform.platform,
            "build_platform_id": job.build_platform_id,
            "build_system_type": job.signature.build_system_type,
            "end_timestamp": to_timestamp(job.end_time),
            "failure_classification_id": job.failure_classification_id,
            "id": job.id,
            "job_group_description": job.job_group.description,
            "job_group_id": job.job_group_id,
            "job_group_name": job.job_group.name,
            "job_group_symbol": job.job_group.symbol,
            "job_guid": job.guid,
            "job_type_description": job.job_type.description,
            "job_type_id": job.job_type_id,
            "job_type_name": job.job_type.name,
            "job_type_symbol": job.job_type.symbol,
            "last_modified": job.last_modified,
            "machine_name": job.machine.name,
            "machine_platform_architecture": job.machine_platform.architecture,
            "machine_platform_os": job.machine_platform.os_name,
            "option_collection_hash": job.option_collection_hash,
            "platform": job.machine_platform.platform,
            "push_id": job.push_id,
            "reason": job.reason,
            "ref_data_name": job.signature.name,
            "result": job.result,
            "result_set_id": job.push_id,
            "signature": job.signature.signature,
            "start_timestamp": to_timestamp(job.start_time),
            "state": job.state,
            "submit_timestamp": to_timestamp(job.submit_time),
            "tier": job.tier,
            "who": job.who,
        }

    class Meta:
        model = models.Job
        fields = "__all__"


class JobSerializer(serializers.ModelSerializer):
    def to_representation(self, job):
        option_collection_map = self.context["option_collection_map"]
        submit = job.pop("submit_time")
        start = job.pop("start_time")
        end = job.pop("end_time")
        option_collection_hash = job.pop("option_collection_hash")

        ret_val = list(job.values())
        ret_val.extend(
            [
                models.Job.get_duration(submit, start, end),  # duration
                option_collection_map.get(option_collection_hash, ""),  # platform option
            ]
        )
        return ret_val

    class Meta:
        model = models.Job
        fields = "__all__"


class FailureClassificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.FailureClassification
        fields = "__all__"


class BugscacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Bugscache
        fields = "__all__"


class FilesBugzillaMapSerializer(serializers.ModelSerializer):
    def to_representation(self, file_bugzilla_component):
        return {
            "product": file_bugzilla_component["bugzilla_component__product"],
            "component": file_bugzilla_component["bugzilla_component__component"],
        }

    class Meta:
        model = models.BugzillaComponent
        fields = "__all__"


class ClassifiedFailureSerializer(serializers.ModelSerializer):
    bug = BugscacheSerializer(read_only=True)

    class Meta:
        model = models.ClassifiedFailure
        exclude = ["created", "modified", "text_log_errors"]


class TextLogErrorMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TextLogErrorMatch
        exclude = ["text_log_error"]


class FailureLineNoStackSerializer(serializers.ModelSerializer):
    unstructured_bugs = NoOpSerializer(read_only=True)

    class Meta:
        model = models.FailureLine
        exclude = ["stack", "stackwalk_stdout", "stackwalk_stderr"]

    def to_representation(self, failure_line):
        """
        Manually add matches our wrapper of the TLEMetadata -> TLE relation.

        I could not work out how to do this multiple relation jump with DRF (or
        even if it was possible) so using this manual method instead.
        """
        try:
            matches = failure_line.error.matches.all()
        except AttributeError:  # failure_line.error can return None
            matches = []
        tle_serializer = TextLogErrorMatchSerializer(matches, many=True)

        classified_failures = models.ClassifiedFailure.objects.filter(error_matches__in=matches)
        cf_serializer = ClassifiedFailureSerializer(classified_failures, many=True)

        response = super().to_representation(failure_line)
        response["matches"] = tle_serializer.data
        response["classified_failures"] = cf_serializer.data
        return response


class TextLogErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TextLogError
        fields = "__all__"


class BugJobMapSerializer(serializers.ModelSerializer):
    job_id = serializers.PrimaryKeyRelatedField(source="job", read_only=True)
    bug_id = serializers.IntegerField(source="bug.bugzilla_id", read_only=True)
    bug_internal_id = serializers.IntegerField(source="bug.id", read_only=True)

    class Meta:
        model = models.BugJobMap
        fields = ["job_id", "bug_id", "bug_internal_id", "created", "who"]


class JobNoteSerializer(serializers.ModelSerializer):
    ordering = ["id"]
    job_id = serializers.PrimaryKeyRelatedField(source="job", read_only=True)

    # these custom fields are for backwards compatibility
    failure_classification_id = serializers.SlugRelatedField(
        slug_field="id", source="failure_classification", read_only=True
    )

    class Meta:
        model = models.JobNote
        fields = ["id", "job_id", "failure_classification_id", "created", "who", "text"]


class JobNoteJobSerializer(serializers.ModelSerializer):
    def to_representation(self, job):
        submit = job.submit_time
        start = job.start_time
        end = job.end_time
        duration = models.Job.get_duration(submit, start, end)

        return {
            "task_id": job.taskcluster_metadata.task_id,
            "job_type_name": job.job_type.name,
            "result": job.result,
            "duration": duration,
        }

    class Meta:
        model = models.Job
        fields = ["duration", "label", "result", "task_id"]


class JobNoteDetailSerializer(serializers.ModelSerializer):
    job = JobNoteJobSerializer()
    failure_classification_name = serializers.SlugRelatedField(
        slug_field="name", source="failure_classification", read_only=True
    )

    class Meta:
        model = models.JobNote
        fields = [
            "id",
            "job",
            "failure_classification_name",
            "created",
            "who",
            "text",
        ]


class CommitSerializer(serializers.ModelSerializer):
    result_set_id = serializers.PrimaryKeyRelatedField(source="push", read_only=True)
    repository_id = serializers.SlugRelatedField(
        slug_field="repository_id", source="push", read_only=True
    )

    class Meta:
        model = models.Commit
        fields = ["result_set_id", "repository_id", "revision", "author", "comments"]


class PushSerializer(serializers.ModelSerializer):
    def get_revisions(self, push):
        serializer = CommitSerializer(instance=push.commits.all().order_by("-id")[:20], many=True)
        return serializer.data

    def get_revision_count(self, push):
        return push.commits.count()

    def get_push_timestamp(self, push):
        return to_timestamp(push.time)

    revisions = serializers.SerializerMethodField()
    revision_count = serializers.SerializerMethodField()
    push_timestamp = serializers.SerializerMethodField()
    repository_id = serializers.PrimaryKeyRelatedField(source="repository", read_only=True)

    class Meta:
        model = models.Push
        fields = [
            "id",
            "revision",
            "author",
            "revisions",
            "revision_count",
            "push_timestamp",
            "repository_id",
        ]


class FailuresSerializer(serializers.ModelSerializer):
    bug_count = serializers.IntegerField()
    bug_id = serializers.IntegerField(source="bug__bugzilla_id", read_only=True)

    class Meta:
        model = models.BugJobMap
        fields = ("bug_id", "bug_count")


class JobTypeNameField(serializers.Field):
    """Removes the ending chunk number"""

    def to_representation(self, value):
        parts = value.split("-")
        try:
            _ = int(parts[-1])
            return "-".join(parts[:-1])
        except ValueError:
            return value


class GroupNameSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="job_log__groups__name")
    job_type_name = JobTypeNameField(source="job_type__name")
    group_status = serializers.CharField(source="job_log__group_result__status")
    failure_classification = serializers.CharField(source="failure_classification_id")
    job_count = serializers.IntegerField()

    class Meta:
        model = models.JobLog
        fields = (
            "group_name",
            "job_type_name",
            "group_status",
            "failure_classification",
            "job_count",
        )


class TestSuiteField(serializers.Field):
    """Removes all characters from test_suite that's also found in platform"""

    def to_representation(self, value):
        build_type = value["build_type"]
        platform = value["job__machine_platform__platform"]
        test_suite = value["job__signature__job_type_name"]
        new_string = test_suite.replace(f"test-{platform}", "")
        new_test_suite = new_string.replace(build_type, "")
        return re.sub(r"^.(/|-)|(/|-)$", "", new_test_suite)


class FailuresByBugSerializer(serializers.ModelSerializer):
    test_suite = TestSuiteField(source="*")
    platform = serializers.CharField(source="job__machine_platform__platform")
    revision = serializers.CharField(source="job__push__revision")
    tree = serializers.CharField(source="job__repository__name")
    push_time = serializers.CharField(source="job__push__time")
    build_type = serializers.CharField()
    machine_name = serializers.CharField(source="job__machine__name")
    lines = serializers.ListField(child=serializers.CharField())
    bug_id = serializers.IntegerField(source="bug__bugzilla_id", read_only=True)
    task_id = serializers.CharField()

    class Meta:
        model = models.BugJobMap
        fields = (
            "push_time",
            "platform",
            "revision",
            "test_suite",
            "tree",
            "build_type",
            "job_id",
            "bug_id",
            "machine_name",
            "lines",
            "task_id",
        )


class FailureCountSerializer(serializers.ModelSerializer):
    test_runs = serializers.IntegerField()
    date = serializers.DateField(format="%Y-%m-%d")
    failure_count = serializers.IntegerField()

    class Meta:
        model = models.Push
        fields = ("date", "test_runs", "failure_count")


class FailuresQueryParamsSerializer(serializers.Serializer):
    startday = serializers.DateTimeField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"])
    endday = serializers.DateTimeField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"])
    tree = serializers.CharField()
    bug = serializers.IntegerField(required=False, allow_null=True, default=None)

    def validate_bug(self, bug):
        if bug is None and self.context == "requireBug":
            raise serializers.ValidationError("This field is required.")

        return bug

    def validate_tree(self, tree):
        if tree != "all" and tree not in REPO_GROUPS:
            try:
                models.Repository.objects.get(name=tree)

            except ObjectDoesNotExist:
                raise serializers.ValidationError(f"{tree} does not exist.")

        return tree


class HashQuerySerializer(serializers.Serializer):
    basehash = serializers.IntegerField()
    newhash = serializers.IntegerField()
    newhashdate = serializers.DateField(format="%Y-%m-%d")
    basehashdate = serializers.DateField(format="%Y-%m-%d")

    def validate_pushes(self, newpush, newhash, newhashdate, basepush, basehash, basehashdate):
        if newpush is None:
            raise serializers.ValidationError(
                f"The date and hash combination you provided({newhashdate} and {newhash}) is invalid"
            )
        if basepush is None:
            raise serializers.ValidationError(
                f"The date and hash combination you provided({basehashdate} and {basehash}) is invalid"
            )


class MachinePlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.MachinePlatform
        fields = ("id", "platform")


class ChangelogSerializer(serializers.ModelSerializer):
    files = serializers.StringRelatedField(many=True)

    class Meta:
        model = Changelog
        fields = (
            "id",
            "remote_id",
            "date",
            "author",
            "message",
            "description",
            "owner",
            "project",
            "project_url",
            "type",
            "url",
            "files",
        )


class InvestigatedTestsSerializers(serializers.ModelSerializer):
    job_name = serializers.CharField(source="job_type.name")
    job_symbol = serializers.CharField(source="job_type.symbol")

    class Meta:
        model = models.InvestigatedTests
        fields = ("id", "test", "job_name", "job_symbol")


class InternalIssueSerializer(serializers.ModelSerializer):
    internal_id = serializers.IntegerField(source="id", read_only=True)

    class Meta:
        model = models.Bugscache
        fields = ("internal_id", "summary")

    def create(self, validated_data):
        """Build or retrieve a bug already reported for a similar FailureLine"""
        try:
            bug, _ = models.Bugscache.objects.exclude(resolution__isnull=False).get_or_create(
                **validated_data, defaults={"modified": timezone.now()}
            )
        except models.Bugscache.MultipleObjectsReturned:
            # Take last modified in case a conflict happens
            bug = models.Bugscache.objects.filter(**validated_data).order_by("modified").first()
        return bug
