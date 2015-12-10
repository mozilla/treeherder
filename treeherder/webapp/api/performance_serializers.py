from rest_framework import serializers

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceSignature)


class TestOptionsSerializer(serializers.JSONField):
    def to_representation(self, obj):
        # if extra_propeties is blank, just return nothing
        if type(obj) == dict:
            return obj.get('test_options', [])
        return []


class PerformanceSignatureSerializer(serializers.ModelSerializer):
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
        fields = ['signature_hash', 'machine_platform', 'suite', 'test',
                  'lower_is_better', 'option_collection_hash',
                  'test_options']


class PerformanceDecimalField(serializers.DecimalField):
    def __init__(self, *args, **kwargs):
        kwargs['max_digits'] = 20
        kwargs['decimal_places'] = 2
        kwargs['coerce_to_string'] = False
        super(PerformanceDecimalField, self).__init__(*args, **kwargs)


class PerformanceAlertSerializer(serializers.ModelSerializer):
    series_signature = PerformanceSignatureSerializer(read_only=True)
    revised_summary_id = serializers.SlugRelatedField(
        slug_field="id", source="revised_summary",
        allow_null=True,
        queryset=PerformanceAlertSummary.objects.all())

    # express quantities in terms of decimals to save space
    amount_abs = PerformanceDecimalField(read_only=True)
    amount_pct = PerformanceDecimalField(read_only=True)
    t_value = PerformanceDecimalField(read_only=True)
    prev_value = PerformanceDecimalField(read_only=True)
    new_value = PerformanceDecimalField(read_only=True)

    class Meta:
        model = PerformanceAlert
        fields = ['id', 'series_signature', 'is_regression', 'prev_value',
                  'new_value', 't_value', 'amount_abs', 'amount_pct',
                  'revised_summary_id']


class PerformanceAlertSummarySerializer(serializers.ModelSerializer):
    alerts = PerformanceAlertSerializer(many=True, read_only=True)
    repository = serializers.SlugRelatedField(read_only=True,
                                              slug_field='name')

    class Meta:
        model = PerformanceAlertSummary
        fields = ['id', 'result_set_id', 'prev_result_set_id', 'last_updated',
                  'repository', 'alerts']
