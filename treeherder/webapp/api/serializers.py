# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.contrib.auth.models import User
from rest_framework import serializers

from treeherder.model import models


class UserExclusionProfileSerializer(serializers.ModelSerializer):
    exclusion_profile = serializers.PrimaryKeyRelatedField()

    class Meta:
        model = models.UserExclusionProfile
        fields = ["is_default", "exclusion_profile"]


class UserSerializer(serializers.ModelSerializer):
    exclusion_profiles = UserExclusionProfileSerializer()

    class Meta:
        model = User
        fields = ["username", "is_superuser", "is_staff", "email", "exclusion_profiles"]


class JobExclusionSerializer(serializers.ModelSerializer):
    info = serializers.WritableField()

    class Meta:
        model = models.JobExclusion


class ExclusionProfileSerializer(serializers.ModelSerializer):

    flat_exclusion = serializers.WritableField(required=False)
    exclusions = serializers.PrimaryKeyRelatedField(many=True)

    class Meta:
        model = models.ExclusionProfile
        exclude = ['users']


class RepositoryGroupSerializer(serializers.ModelSerializer):

    class Meta:
        model = models.RepositoryGroup
        fields = ('name', 'description')


class RepositorySerializer(serializers.ModelSerializer):
    repository_group = RepositoryGroupSerializer()

    class Meta:
        model = models.Repository
