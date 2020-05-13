from rest_framework import serializers

from django.core.exceptions import ObjectDoesNotExist

from treeherder.model.models import Repository


class InfraCompareSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    duration = serializers.IntegerField()
    job_type__name = serializers.CharField()
    result = serializers.CharField()


class InfraCompareQuerySerializers(serializers.Serializer):
    revision = serializers.CharField(required=False, allow_null=False, default=None)
    project = serializers.CharField()
    interval = serializers.IntegerField(required=False, allow_null=True, default=None)
    startday = serializers.DateTimeField(required=False, allow_null=True, default=None)
    endday = serializers.DateTimeField(required=False, allow_null=True, default=None)

    def validate(self, data):
        if (
            data['revision'] is None
            and data['interval'] is None
            and (data['startday'] is None or data['endday'] is None)
        ):
            raise serializers.ValidationError(
                'Required: revision, startday and endday, or interval.'
            )

        return data

    def validate_repository(self, project):
        try:
            Repository.objects.get(name=project)

        except ObjectDoesNotExist:
            raise serializers.ValidationError('{} does not exist.'.format(project))

        return project
