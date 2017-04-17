from django.db import transaction

from rest_framework import serializers

from django_ci import models


class RevisionListSerializer(serializers.ListSerializer):

    def create(self, validated_data):
        revisions = [models.Revision(**item) for item in validated_data]
        return models.Revision.objects.bulk_try_create(
            ('revision', 'repository'),  *revisions)


class RevisionSerializer(serializers.ModelSerializer):
    repository = serializers.SlugRelatedField(
        slug_field='name',
        queryset=models.Repository.objects.filter(active_status=True))

    class Meta:
        model = models.Revision
        fields = ('id', 'revision', 'author', 'comments', 'commit_timestamp',
                  'files','repository')
        list_serializer_class = RevisionListSerializer


class ResultSetListSerializer(serializers.ListSerializer):

    @transaction.atomic
    def create(self, validated_data):
        stored_revisions = []
        result_set_list = []
        for result_set_data in validated_data:
            revision_data = result_set_data.pop('revisions')
            revision_list = [models.Revision(**item) for item in revision_data]
            stored_revisions.append(models.Revision.objects.bulk_try_create(
            ('revision', 'repository'),  *revision_list))

            result_set_list.append(models.ResultSet(**result_set_data))
            stored_result_sets = models.ResultSet.objects.bulk_try_create(
                ('revision_hash',), *result_set_list)

        for index, result_set in enumerate(stored_result_sets):
            result_set.revisions = stored_revisions[index]

        return stored_result_sets


class ResultSetSerializer(serializers.ModelSerializer):
    repository = serializers.SlugRelatedField(
        slug_field='name',
        queryset=models.Repository.objects.filter(active_status=True))
    revisions = RevisionSerializer(many=True)

    @transaction.atomic
    def create(self, validated_data):
        revisions_data = validated_data.pop('revisions')
        revisions = [models.Revision(**item) for item in revisions_data]
        stored_revisions = models.Revision.objects.bulk_try_create(
            ('revision', 'repository'),  *revisions)
        result_set, _ = models.ResultSet.objects.get_or_create(**validated_data)
        result_set.revisions = stored_revisions
        result_set.save()
        return result_set


    class Meta:
        model = models.ResultSet
        fields = ('id', 'revision_hash', 'author', 'push_timestamp', 'revisions',
                  'repository')
        list_serializer_class = ResultSetListSerializer
