from django.contrib.auth.models import User
from rest_framework import (exceptions,
                            serializers)

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceBugTemplate,
                                    PerformanceFramework,
                                    PerformanceSignature)


class PerformanceFrameworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceFramework
        fields = ['id', 'name']


class TestOptionsSerializer(serializers.JSONField):
    def to_representation(self, obj):
        # if extra_propeties is blank, just return nothing
        if type(obj) == dict:
            return obj.get('test_options', [])
        return []


class PerformanceSignatureSerializer(serializers.ModelSerializer):
    framework_id = serializers.SlugRelatedField(
        slug_field="id", source="framework",
        queryset=PerformanceFramework.objects.all())
    option_collection_hash = serializers.SlugRelatedField(
        read_only=True, slug_field="option_collection_hash",
        source="option_collection")
    machine_platform = serializers.SlugRelatedField(read_only=True,
                                                    slug_field="platform",
                                                    source="platform")
    test_options = TestOptionsSerializer(read_only=True,
                                         source="extra_properties")

    class Meta:
        model = PerformanceSignature
        fields = ['framework_id', 'signature_hash', 'machine_platform',
                  'suite', 'test', 'lower_is_better', 'has_subtests',
                  'option_collection_hash', 'test_options']


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
        slug_field="email", allow_null=True, required=False,
        queryset=User.objects.all())

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

    class Meta:
        model = PerformanceAlert
        fields = ['id', 'status', 'series_signature', 'is_regression',
                  'prev_value', 'new_value', 't_value', 'amount_abs',
                  'amount_pct', 'summary_id', 'related_summary_id',
                  'manually_created', 'classifier']


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
                  'related_alerts', 'status', 'bug_number']


class PerformanceBugTemplateSerializer(serializers.ModelSerializer):

    framework = serializers.SlugRelatedField(read_only=True,
                                             slug_field='id')

    class Meta:
        model = PerformanceBugTemplate
        fields = ['framework', 'keywords', 'status_whiteboard',
                  'default_component', 'default_product', 'cc_list', 'text']
