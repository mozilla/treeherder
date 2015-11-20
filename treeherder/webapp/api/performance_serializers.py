from rest_framework import serializers

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceSignature)


class PerformanceSignatureSerializer(serializers.ModelSerializer):
    option_collection_hash = serializers.SlugRelatedField(
        read_only=True, slug_field="option_collection_hash",
        source="option_collection")
    machine_platform = serializers.SlugRelatedField(read_only=True,
                                                    slug_field="platform",
                                                    source="platform")

    class Meta:
        model = PerformanceSignature
        fields = ['signature_hash', 'machine_platform', 'suite', 'test',
                  'lower_is_better', 'option_collection_hash']


class PerformanceDecimalField(serializers.DecimalField):
    def __init__(self, *args, **kwargs):
        kwargs['max_digits'] = 20
        kwargs['decimal_places'] = 2
        kwargs['coerce_to_string'] = False
        super(PerformanceDecimalField, self).__init__(*args, **kwargs)


class PerformanceAlertSerializer(serializers.ModelSerializer):
    series_signature = PerformanceSignatureSerializer(read_only=True)

    # express quantities in terms of decimals to save space
    amount_abs = PerformanceDecimalField(read_only=True)
    amount_pct = PerformanceDecimalField(read_only=True)
    t_value = PerformanceDecimalField(read_only=True)
    prev_value = PerformanceDecimalField(read_only=True)
    new_value = PerformanceDecimalField(read_only=True)

    class Meta:
        model = PerformanceAlert
        fields = ['series_signature', 'is_regression', 'prev_value',
                  'new_value', 't_value', 'amount_abs', 'amount_pct']


class PerformanceAlertSummarySerializer(serializers.ModelSerializer):
    alerts = PerformanceAlertSerializer(many=True, read_only=True)
    repository = serializers.SlugRelatedField(read_only=True,
                                              slug_field='name')

    class Meta:
        model = PerformanceAlertSummary
        fields = ['id', 'result_set_id', 'prev_result_set_id', 'last_updated',
                  'repository', 'alerts']
