from django.contrib.auth.models import User
from django.db import models


class UserExclusionProfile(models.Model):

    """
    An extension to the standard user model that keeps the exclusion
    profile relationship.
    """

    user = models.ForeignKey(User, related_name="exclusion_profiles")
    exclusion_profile = models.ForeignKey("ExclusionProfile", blank=True, null=True)
    is_default = models.BooleanField(default=True)
