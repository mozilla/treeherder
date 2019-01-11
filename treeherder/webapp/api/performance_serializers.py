import decimal

import six
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import (exceptions,
                            serializers)

from treeherder.model import models
from treeherder.perf.models import (IssueTracker,
                                    PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceBugTemplate,
                                    PerformanceFramework,
                                    PerformanceSignature)


class PerformanceFrameworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceFramework
        fields = ['id', 'name']


class TestOptionsSerializer(serializers.CharField):
    def to_representation(self, obj):
        # if extra_options str is blank, just return nothing
        if isinstance(obj, six.string_types):
            return obj.split(' ')
        return []


class PerformanceSignatureSerializer(serializers.ModelSerializer):
    option_collection_hash = serializers.SlugRelatedField(
        read_only=True, slug_field="option_collection_hash",
        source="option_collection")
    machine_platform = serializers.SlugRelatedField(read_only=True,
                                                    slug_field="platform",
                                                    source="platform")
    extra_options = TestOptionsSerializer(read_only=True,
                                          allow_blank=True)

    class Meta:
        model = PerformanceSignature
        fields = ['id', 'framework_id', 'signature_hash', 'machine_platform',
                  'suite', 'test', 'lower_is_better', 'has_subtests',
                  'option_collection_hash', 'extra_options']


class PerformanceDecimalField(serializers.DecimalField):
    def __init__(self, *args, **kwargs):
        kwargs['max_digits'] = 20
        kwargs['decimal_places'] = 2
        kwargs['coerce_to_string'] = False
        super(PerformanceDecimalField, self).__init__(*args, **kwargs)


class PerformanceAlertSerializer(serializers.ModelSerializer):
    series_signature = PerformanceSignatureSerializer(read_only=True)
    summary_id = serializers.SlugRelatedField(
        slug_field="id", source="summary", required=False,
        queryset=PerformanceAlertSummary.objects.all())
    related_summary_id = serializers.SlugRelatedField(
        slug_field="id", source="related_summary",
        allow_null=True, required=False,
        queryset=PerformanceAlertSummary.objects.all())
    classifier = serializers.SlugRelatedField(
        slug_field="username", allow_null=True, required=False,
        queryset=User.objects.all())
    classifier_email = serializers.SerializerMethodField()

    # express quantities in terms of decimals to save space
    amount_abs = PerformanceDecimalField(read_only=True)
    amount_pct = PerformanceDecimalField(read_only=True)
    t_value = PerformanceDecimalField(read_only=True)
    prev_value = PerformanceDecimalField(read_only=True)
    new_value = PerformanceDecimalField(read_only=True)

    def update(self, instance, validated_data):
        # ensure the related summary, if set, has the same repository and
        # framework as the original summary
        related_summary = validated_data.get('related_summary')
        if related_summary:
            if (validated_data.get('status', instance.status) != PerformanceAlert.DOWNSTREAM and
                    instance.summary.repository_id != related_summary.repository_id):
                raise exceptions.ValidationError(
                    "New summary's repository ({}) does not match existing "
                    "summary's repository ({})".format(
                        related_summary.repository,
                        instance.summary.framework))
            elif instance.summary.framework_id != related_summary.framework_id:
                raise exceptions.ValidationError(
                    "New summary's framework ({}) does not match existing "
                    "summary's framework ({})".format(
                        related_summary.framework,
                        instance.summary.framework))
        return super(PerformanceAlertSerializer, self).update(instance,
                                                              validated_data)

    def get_classifier_email(self, performance_alert):
        return getattr(performance_alert.classifier, 'email', None)

    class Meta:
        model = PerformanceAlert
        fields = ['id', 'status', 'series_signature', 'is_regression',
                  'prev_value', 'new_value', 't_value', 'amount_abs',
                  'amount_pct', 'summary_id', 'related_summary_id',
                  'manually_created', 'classifier', 'starred', 'classifier_email']


class PerformanceAlertSummarySerializer(serializers.ModelSerializer):
    alerts = PerformanceAlertSerializer(many=True, read_only=True)
    related_alerts = PerformanceAlertSerializer(many=True, read_only=True)
    repository = serializers.SlugRelatedField(read_only=True,
                                              slug_field='name')
    framework = serializers.SlugRelatedField(read_only=True,
                                             slug_field='id')

    # marking these fields as readonly, the user should not be modifying them
    # (after the item is first created, where we don't use this serializer
    # class)
    prev_push_id = serializers.ReadOnlyField()
    push_id = serializers.ReadOnlyField()
    last_updated = serializers.ReadOnlyField()

    class Meta:
        model = PerformanceAlertSummary
        fields = ['id', 'push_id', 'prev_push_id',
                  'last_updated', 'repository', 'framework', 'alerts',
                  'related_alerts', 'status', 'bug_number',
                  'issue_tracker', 'notes']


class PerformanceBugTemplateSerializer(serializers.ModelSerializer):

    framework = serializers.SlugRelatedField(read_only=True,
                                             slug_field='id')

    class Meta:
        model = PerformanceBugTemplate
        fields = ['framework', 'keywords', 'status_whiteboard',
                  'default_component', 'default_product', 'cc_list', 'text']


class IssueTrackerSerializer(serializers.ModelSerializer):
    text = serializers.CharField(read_only=True,
                                 source='name')
    issueTrackerUrl = serializers.URLField(read_only=True,
                                           source='task_base_url')

    class Meta:
        model = IssueTracker
        fields = ['id', 'text', 'issueTrackerUrl']


class PerformanceQueryParamsSerializer(serializers.Serializer):
    startday = serializers.DateTimeField(required=False, allow_null=True, default=None)
    endday = serializers.DateTimeField(required=False, allow_null=True, default=None)
    revision = serializers.CharField(required=False, allow_null=True, default=None)
    repository = serializers.CharField()
    framework = serializers.ListField(child=serializers.IntegerField())
    interval = serializers.IntegerField(required=False, allow_null=True, default=None)
    parent_signature = serializers.CharField(required=False, allow_null=True, default=None)
    no_subtests = serializers.BooleanField(required=False)

    def validate(self, data):
        if data['revision'] is None and (data['startday'] is None or data['endday'] is None):
            raise serializers.ValidationError('Required: revision or startday and endday.')

        return data

    def validate_repository(self, repository):
        try:
            models.Repository.objects.get(name=repository)

        except ObjectDoesNotExist:
            raise serializers.ValidationError('{} does not exist.'.format(repository))

        return repository


class PerformanceRevisionSerializer(serializers.ModelSerializer):
    platform = serializers.CharField(source="platform__platform")
    values = serializers.ListField(child=serializers.DecimalField(
        rounding=decimal.ROUND_HALF_EVEN, decimal_places=2, max_digits=None, coerce_to_string=False))
    name = serializers.SerializerMethodField()
    parent_signature = serializers.CharField(source="parent_signature__signature_hash")

    class Meta:
        model = PerformanceSignature
        fields = ['id', 'framework_id', 'signature_hash', 'platform', 'test',
                  'lower_is_better', 'has_subtests', 'values', 'name', 'parent_signature']

    def get_name(self, value):
        test = value['test']
        suite = value['suite']
        test_suite = suite if test == '' or test == suite else '{} {}'.format(suite, test)
        return '{} {} {}'.format(test_suite, value['option_collection__option__name'],
                                 value['extra_options'])
