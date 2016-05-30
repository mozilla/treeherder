from rest_framework import (exceptions,
                            serializers)

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
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
                  'suite', 'test', 'lower_is_better',
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

    # express quantities in terms of decimals to save space
    amount_abs = PerformanceDecimalField(read_only=True)
    amount_pct = PerformanceDecimalField(read_only=True)
    t_value = PerformanceDecimalField(read_only=True)
    prev_value = PerformanceDecimalField(read_only=True)
    new_value = PerformanceDecimalField(read_only=True)

    def update(self, instance, validated_data):
        if instance.summary.repository != validated_data['summary'].repository:
            raise exceptions.ValidationError("New summary's repository does "
                                             "not match existing summary's "
                                             "repository")
        if instance.summary.framework != validated_data['summary'].framework:
            raise exceptions.ValidationError("New summary's framework does "
                                             "not match existing summary's "
                                             "framework")
        return super(PerformanceAlertSerializer, self).update(instance,
                                                              validated_data)

    class Meta:
        model = PerformanceAlert
        fields = ['id', 'status', 'series_signature', 'is_regression',
                  'prev_value', 'new_value', 't_value', 'amount_abs',
                  'amount_pct', 'summary_id', 'related_summary_id']


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
    prev_result_set_id = serializers.ReadOnlyField()
    result_set_id = serializers.ReadOnlyField()
    last_updated = serializers.ReadOnlyField()

    class Meta:
        model = PerformanceAlertSummary
        fields = ['id', 'result_set_id', 'prev_result_set_id',
                  'last_updated', 'repository', 'framework', 'alerts',
                  'related_alerts', 'status', 'bug_number']
